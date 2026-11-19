const { prisma } = require("@big-eds/database");
const { ConflictError, NotFoundError } = require("../lib/errors");
const { nextSequenceValue } = require("../lib/sequentialNumber");
const { verifyManagerPin } = require("../lib/posPin");
const inventoryService = require("./inventory.service");
const storeCreditService = require("./storeCredit.service");
const posCustomersService = require("./posCustomers.service");

// Discounts up to this percent of subtotal are a cashier's own call; above
// it, a manager/admin must authorize via their POS PIN (see ../lib/posPin).
// This applies regardless of which input mode (PERCENT or FLAT_CENTS) the
// cashier used — a flat-dollar discount that happens to exceed this percent
// of the subtotal still requires the override.
const CASHIER_DISCOUNT_CEILING_PERCENT = 10;

// Shared with orders.routes.js and posReturns.service.js's own
// nextOrderNumber — every Order, regardless of channel, draws from this one
// "order" counter so numbers never collide across ONLINE/POS/exchange orders.
async function nextOrderNumber(tx) {
  const count = await nextSequenceValue("order", tx);
  return `BE-${100000 + count}`;
}

async function nextReceiptNumber(tx) {
  const count = await nextSequenceValue("receipt", tx);
  return `RCPT-${100000 + count}`;
}

function serializeSession(session) {
  return {
    id: session.id,
    registerId: session.registerId,
    registerName: session.register?.name,
    locationName: session.register?.location?.name,
    status: session.status,
    openingCashCents: session.openingCashCents,
    closingCashCents: session.closingCashCents,
    expectedCashCents: session.expectedCashCents,
    discrepancyCents: session.discrepancyCents,
    openedById: session.openedById,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    reopenRequestedById: session.reopenRequestedById,
    reopenRequestedAt: session.reopenRequestedAt,
    reopenApprovedById: session.reopenApprovedById,
    reopenApprovedAt: session.reopenApprovedAt,
    reopenDeniedAt: session.reopenDeniedAt,
    reopenDenialReason: session.reopenDenialReason,
  };
}

async function openRegister({ registerId, openingCashCents, openedById }) {
  const register = await prisma.register.findUnique({ where: { id: registerId } });
  if (!register) throw new NotFoundError("Register not found");
  if (!register.isActive) throw new ConflictError("Register is not active");

  const blockingSession = await prisma.registerSession.findFirst({
    where: { registerId, status: { in: ["OPEN", "PENDING_REOPEN_APPROVAL"] } },
  });
  if (blockingSession) {
    if (blockingSession.status === "PENDING_REOPEN_APPROVAL") {
      throw new ConflictError("Register is awaiting manager approval to reopen", {
        registerSessionId: blockingSession.id,
      });
    }
    throw new ConflictError("Register already has an open session", {
      registerSessionId: blockingSession.id,
    });
  }

  const session = await prisma.registerSession.create({
    data: { registerId, openedById, openingCashCents, status: "OPEN" },
    include: { register: { include: { location: true } } },
  });

  return serializeSession(session);
}

async function getOpenSession(registerSessionId) {
  const session = await prisma.registerSession.findUnique({
    where: { id: registerSessionId },
    include: { register: true },
  });
  if (!session) throw new NotFoundError("Register session not found");
  if (session.status !== "OPEN") throw new ConflictError("Register session is not open");
  return session;
}

// Creates one Payment row per split-tender entry (plus a CashMovement for
// each CASH entry and a StoreCredit redemption for each STORE_CREDIT entry)
// inside the caller's existing transaction. Shared by ringSale() and the
// exchange-balance-due path in posReturns.service.js so the two don't
// diverge on how a multi-tender payment is recorded.
async function createPaymentEntries(tx, { orderId, registerSessionId, payments, customerId, performedById }) {
  const createdPayments = [];
  for (const entry of payments) {
    const payment = await tx.payment.create({
      data: {
        orderId,
        method: entry.method,
        status: "SUCCEEDED",
        amountCents: entry.amountCents,
        reference: entry.reference || null,
        performedById,
      },
    });
    createdPayments.push(payment);

    if (entry.method === "CASH") {
      await tx.cashMovement.create({
        data: {
          registerSessionId,
          type: "SALE",
          amountCents: entry.amountCents,
          notes: `Payment ${payment.id}`,
        },
      });
    } else if (entry.method === "DEPOSIT") {
      await tx.cashMovement.create({
        data: {
          registerSessionId,
          type: "DEPOSIT",
          amountCents: entry.amountCents,
          notes: `Payment ${payment.id}`,
        },
      });
    } else if (entry.method === "STORE_CREDIT") {
      await storeCreditService.redeemStoreCredit(tx, {
        customerId,
        amountCents: entry.amountCents,
        orderId,
        performedById,
      });
    }
    // CARD is rejected before this function is ever reached; BANK_TRANSFER
    // doesn't move the physical cash drawer, so no CashMovement for it.
  }
  return createdPayments;
}

// Rings up a walk-in sale: prices the lines server-side from live variant
// data (never trusts client-sent prices), reserves stock, immediately
// converts the reservation to a sale (a POS cashier completes checkout in
// one motion, unlike the online cart), and creates the Payment(s) + Receipt
// records. A sale can be tendered across multiple payment entries (CASH,
// DEPOSIT, BANK_TRANSFER, STORE_CREDIT) in one transaction; CARD is
// rejected — no payment processor/terminal has been selected yet (see
// docs/requirements/open-questions.md) and this function must never
// fabricate a successful card charge.
async function ringSale({
  registerSessionId,
  lines,
  payments,
  discount,
  discountReasonCode,
  pinOverride,
  salesAttribution,
  requestedDeliveryAt,
  shippingAddress,
  billingAddress,
  billingSameAsShipping,
  customerId: inputCustomerId,
  customerInput,
  performedById,
}) {
  if (payments.some((p) => p.method === "CARD")) {
    throw new ConflictError(
      "Card-present tender is not available yet — no payment processor or terminal model has been selected. Use cash, deposit, bank transfer, or store credit."
    );
  }

  const session = await getOpenSession(registerSessionId);
  const locationId = session.register.locationId;
  if (!locationId) {
    throw new ConflictError("Register is not assigned to a stock location");
  }

  const variantIds = lines.map((l) => l.variantId);
  const variants = await prisma.variant.findMany({ where: { id: { in: variantIds } }, include: { product: true } });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  for (const line of lines) {
    const variant = variantById.get(line.variantId);
    if (!variant || !variant.isActive) {
      throw new ConflictError(`Product variant ${line.variantId} is not available`);
    }
  }

  const subtotalCents = lines.reduce((sum, l) => sum + variantById.get(l.variantId).priceCents * l.quantity, 0);

  // Resolve the discount to a concrete cents figure server-side — never
  // trust a client-sent cents value for PERCENT mode, recompute it fresh
  // from the server-priced subtotal (same "never trust frontend-computed
  // totals" rule already applied to payments below).
  let discountCents = 0;
  let discountPercent = null;
  if (discount?.mode === "PERCENT") {
    discountPercent = discount.percent;
    discountCents = Math.round((subtotalCents * discount.percent) / 100);
  } else if (discount?.mode === "FLAT_CENTS") {
    discountCents = discount.amountCents;
  }

  // Unsupervised cashier ceiling: a discount whose effective rate exceeds
  // this percent of subtotal needs a manager/admin's POS PIN, regardless of
  // whether it was entered as a percent or a flat dollar amount — a flat
  // discount that happens to be >10% of this particular subtotal must still
  // trip the ceiling.
  const effectivePercent = subtotalCents > 0 ? (discountCents / subtotalCents) * 100 : 0;
  let discountApprovedById = null;
  if (discountCents > 0 && effectivePercent > CASHIER_DISCOUNT_CEILING_PERCENT) {
    if (!pinOverride?.approverPin) {
      throw new ConflictError(
        `Discounts over ${CASHIER_DISCOUNT_CEILING_PERCENT}% require a manager PIN override`,
        { ceilingPercent: CASHIER_DISCOUNT_CEILING_PERCENT, effectivePercent }
      );
    }
    discountApprovedById = await verifyManagerPin(pinOverride.approverPin);
    if (!discountApprovedById) {
      await prisma.auditLog.create({
        data: {
          userId: performedById,
          action: "pos.sale.discount.pin_denied",
          entityType: "User",
          entityId: performedById,
          metadata: { effectivePercent },
        },
      });
      throw new ConflictError("Invalid manager PIN");
    }
  }

  if (discountCents > subtotalCents) {
    throw new ConflictError("Discount cannot exceed the order subtotal", { subtotalCents, discountCents });
  }

  // Tax applies per line, at that variant's own flat rate, on the line's
  // taxable base (its share of the subtotal minus its prorated share of the
  // order-level discount — POS discounts aren't entered per line, so each
  // line absorbs a share of the discount proportional to its own subtotal
  // share before tax is computed on what's left). Remainder cents from
  // rounding each line's discount share land on the last line, the same
  // "largest remainder to the last bucket" approach as elsewhere in this
  // codebase's money math, so the per-line discounts always sum to exactly
  // discountCents.
  let allocatedDiscountCents = 0;
  const lineTaxCentsByIndex = lines.map((l, i) => {
    const variant = variantById.get(l.variantId);
    const lineSubtotalCents = variant.priceCents * l.quantity;
    const isLastLine = i === lines.length - 1;
    const lineDiscountCents = isLastLine
      ? discountCents - allocatedDiscountCents
      : subtotalCents > 0
        ? Math.round((discountCents * lineSubtotalCents) / subtotalCents)
        : 0;
    allocatedDiscountCents += lineDiscountCents;
    const taxableCents = lineSubtotalCents - lineDiscountCents;
    return Math.round((taxableCents * Number(variant.taxRatePercent)) / 100);
  });
  const taxCents = lineTaxCentsByIndex.reduce((sum, t) => sum + t, 0);

  const totalCents = subtotalCents - (discountCents || 0) + taxCents;

  // Hard floor: a discount (or combination of discounted lines) is never
  // allowed to bring the order total below what we paid for the goods in
  // it — confirmed product decision, no manager override today. Variants
  // with costCents still null (no PO receipt or backfill has reached them
  // yet) contribute 0 to totalCostCents rather than blocking the sale on
  // unknown data; this only ever protects against a KNOWN loss, never
  // guesses one.
  const totalCostCents = lines.reduce(
    (sum, l) => sum + (variantById.get(l.variantId).costCents ?? 0) * l.quantity,
    0
  );
  if (totalCents < totalCostCents) {
    throw new ConflictError("This sale's total is below the cost of the items in it — adjust the discount", {
      totalCents,
      totalCostCents,
    });
  }

  // Never trust frontend-computed totals: recompute every figure below from
  // the payments array itself.
  const totalTenderedCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const cashEntries = payments.filter((p) => p.method === "CASH");
  const nonCashTenderedCents = totalTenderedCents - cashEntries.reduce((sum, p) => sum + p.amountCents, 0);

  // Only cash can overtender (to produce change); every other method must
  // not individually or collectively exceed what's actually owed.
  if (nonCashTenderedCents > totalCents) {
    throw new ConflictError("Non-cash payment amounts cannot exceed the order total", {
      totalCents,
      nonCashTenderedCents,
    });
  }

  const storeCreditEntries = payments.filter((p) => p.method === "STORE_CREDIT");
  if (storeCreditEntries.length > 0 && !inputCustomerId) {
    throw new ConflictError("Store credit can only be redeemed for an identified customer");
  }

  let customerId = inputCustomerId || null;
  if (!customerId && customerInput?.email) {
    const customer = await posCustomersService.createPosCustomer({
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      email: customerInput.email,
    });
    customerId = customer.id;
  }

  if (storeCreditEntries.length > 0) {
    const requestedStoreCreditCents = storeCreditEntries.reduce((sum, p) => sum + p.amountCents, 0);
    const balanceCents = await storeCreditService.getStoreCreditBalance(customerId);
    if (requestedStoreCreditCents > balanceCents) {
      throw new ConflictError("Store credit requested exceeds the customer's balance", {
        balanceCents,
        requestedCents: requestedStoreCreditCents,
      });
    }
  }

  // A sale tendered below the total is only ever legitimate as a deliberate
  // deposit/layaway (at least one DEPOSIT entry present) — any other
  // under-tender (e.g. cash alone falling short) is rejected outright,
  // exactly as the single-tender flow always did for CASH.
  if (totalTenderedCents < totalCents && !payments.some((p) => p.method === "DEPOSIT")) {
    throw new ConflictError("Tendered amount is less than the amount due", {
      amountDueCents: totalCents,
      totalTenderedCents,
    });
  }

  // Defaults the sale's credit to the cashier themself when the frontend
  // sends nothing — defense-in-depth, the frontend should always send at
  // least one attribution entry. OrderSalesAttribution.userId is a required
  // FK, so there's nothing to default to (and nothing to create) when this
  // call has no real performer — same "unattributed system action" case
  // AuditLog.userId already tolerates elsewhere in this service.
  const resolvedAttribution = salesAttribution?.length
    ? salesAttribution
    : performedById
      ? [{ userId: performedById, role: "SALESMAN", percent: 100 }]
      : [];

  const order = await prisma.$transaction(async (tx) => {
    // Resolve billing/shipping address snapshots inside the same
    // transaction that creates the order — a half-written order with one
    // address but not the other must never persist. These are always
    // freestanding rows (customerId null), never the customer's saved
    // address book, since a POS-captured address isn't necessarily the
    // customer's own (e.g. a gift). Purely informational — capturing one
    // doesn't depend on (or imply) any particular fulfillment method.
    // Billing is captured first in the UI; "same as billing" copies it
    // into shipping.
    let shippingAddressId = null;
    let billingAddressId = null;
    if (billingAddress) {
      const createdBilling = await tx.address.create({
        data: { type: "BILLING", customerId: null, ...billingAddress },
      });
      billingAddressId = createdBilling.id;

      const shippingData = billingSameAsShipping ? billingAddress : shippingAddress;
      if (shippingData) {
        const createdShipping = await tx.address.create({
          data: { type: "SHIPPING", customerId: null, ...shippingData },
        });
        shippingAddressId = createdShipping.id;
      }
    }

    const orderNumber = await nextOrderNumber(tx);
    return tx.order.create({
      data: {
        orderNumber,
        channel: "POS",
        customerId,
        status: "DRAFT",
        paymentStatus: "UNPAID",
        fulfillmentStatus: "UNALLOCATED",
        fulfillmentMethod: "IN_STORE",
        subtotalCents,
        taxCents,
        discountCents: discountCents || 0,
        discountPercent,
        discountApprovedById,
        requestedDeliveryAt: requestedDeliveryAt || null,
        shippingAddressId,
        billingAddressId,
        totalCents,
        lines: {
          create: lines.map((l, i) => {
            const variant = variantById.get(l.variantId);
            const thisLineTaxCents = lineTaxCentsByIndex[i];
            return {
              variantId: variant.id,
              skuSnapshot: variant.sku,
              nameSnapshot: `${variant.product.name} — ${variant.name}`,
              quantity: l.quantity,
              unitPriceCents: variant.priceCents,
              taxCents: thisLineTaxCents,
              lineTotalCents: variant.priceCents * l.quantity + thisLineTaxCents,
            };
          }),
        },
        salesAttributions: {
          create: resolvedAttribution.map((a) => ({
            userId: a.userId,
            role: a.role,
            splitPercent: a.percent,
          })),
        },
      },
      include: { lines: true, customer: true, salesAttributions: true },
    });
  });

  // Reserve+convert each line in a single transaction (reserveAndConvertForSale)
  // rather than two separately-committed ones — a POS cashier completes
  // checkout in one motion, so there's no reason to pay for an intermediate
  // ACTIVE-reservation round trip the way online checkout's reserve-now/
  // convert-later flow needs. Lines run concurrently: each only locks its own
  // variant's StockBalance row (same FOR UPDATE this always used), so
  // distinct-product lines don't block each other, and same-variant lines
  // (two cart rows for one SKU) still serialize correctly via Postgres's own
  // row-lock queuing inside each call's transaction — concurrent POS/web
  // sales for the same variant still serialize on that row exactly as before.
  const settled = await Promise.allSettled(
    lines.map((line) =>
      inventoryService.reserveAndConvertForSale({
        variantId: line.variantId,
        locationId,
        quantity: line.quantity,
        orderId: order.id,
        performedById,
        referenceId: order.id,
      })
    )
  );

  const reservationFailures = [];
  const convertedLineVariantIds = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      convertedLineVariantIds.push(lines[index].variantId);
    } else {
      reservationFailures.push(lines[index].variantId);
    }
  });

  if (reservationFailures.length > 0) {
    // Compensate every line that did succeed before cancelling the order —
    // a sale that's half rung up must never be left ambiguous, regardless of
    // which lines happened to win the race.
    for (const variantId of convertedLineVariantIds) {
      const line = lines.find((l) => l.variantId === variantId);
      await inventoryService.adjustStock({
        variantId,
        locationId,
        type: "ADJUSTMENT_INCREASE",
        quantity: line.quantity,
        reasonCode: "pos_sale_rollback",
        performedById,
      });
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELED" } });
    throw new ConflictError("One or more items went out of stock while ringing up this sale", {
      unavailableVariantIds: reservationFailures,
    });
  }

  // Any overtender can only come from cash (every other method is capped at
  // the remaining balance above), so change due is simply how much the
  // total was overtendered by.
  const changeDueCents = Math.max(0, totalTenderedCents - totalCents);

  // The Payment/CashMovement rows must reflect money actually APPLIED to the
  // sale, never the raw amount handed over — a $110 cash tender against a
  // $100 sale keeps $100 in the drawer and returns $10 as change, so only
  // $100 may ever be recorded as a Payment or move the register's cash
  // total. Change is tracked purely in the API response for the receipt,
  // never fed into a ledger row. Only the LAST cash entry absorbs the
  // trim, so splitting one tender across multiple cash entries still
  // records each earlier entry's full amount.
  const appliedPayments =
    changeDueCents > 0
      ? (() => {
          let remainingTrim = changeDueCents;
          const trimmed = [];
          for (let i = payments.length - 1; i >= 0; i--) {
            const entry = payments[i];
            if (entry.method === "CASH" && remainingTrim > 0) {
              const cut = Math.min(remainingTrim, entry.amountCents);
              remainingTrim -= cut;
              if (entry.amountCents - cut > 0) {
                trimmed.unshift({ ...entry, amountCents: entry.amountCents - cut });
              }
            } else {
              trimmed.unshift(entry);
            }
          }
          return trimmed;
        })()
      : payments;

  const result = await prisma.$transaction(async (tx) => {
    const createdPayments = await createPaymentEntries(tx, {
      orderId: order.id,
      registerSessionId,
      payments: appliedPayments,
      customerId,
      performedById,
    });

    const paymentStatus =
      totalTenderedCents >= totalCents ? "PAID" : totalTenderedCents > 0 ? "PARTIALLY_PAID" : "UNPAID";

    // Stock is already reserved+converted (sold) at this point regardless of
    // payment amount (see reserveAndConvertForSale above), but fulfillment
    // itself — handing the item to the customer — is no longer assumed to
    // happen in the same motion as ringing the sale. A fresh POS sale (full
    // payment or a deposit) now lands at RESERVED, the same real
    // fulfillmentStatus online checkout's post-confirm state uses, so a
    // manager/admin advances both channels through the same manual
    // Ordered -> Ready -> Completed status change (see
    // apps/api/src/services/orderStatus.service.js and
    // PATCH /admin/orders/:id/status) rather than POS sales skipping
    // straight to "handed over." paymentStatus (computed just above,
    // unchanged) is what still distinguishes a full-pay sale ("Ordered")
    // from a deposit sale ("Draft") at this same fulfillmentStatus value.
    const fulfillmentStatus = "RESERVED";

    const confirmedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CONFIRMED",
        fulfillmentStatus,
        paymentStatus,
      },
      include: {
        lines: true,
        customer: true,
        payments: true,
        salesAttributions: { include: { user: { select: { firstName: true, lastName: true } } } },
        shippingAddress: true,
        billingAddress: true,
      },
    });

    const receiptNumber = await nextReceiptNumber(tx);
    const receipt = await tx.receipt.create({
      data: {
        registerSessionId,
        orderId: order.id,
        receiptNumber,
      },
    });

    if (discountCents > 0) {
      await tx.auditLog.create({
        data: {
          userId: performedById,
          action: "pos.sale.discount",
          entityType: "Order",
          entityId: order.id,
          reasonCode: discountReasonCode,
          metadata: {
            discountCents,
            subtotalCents,
            discountPercent,
            discountMode: discount?.mode ?? null,
            approvedByUserId: discountApprovedById,
            approvedViaPin: Boolean(discountApprovedById),
          },
        },
      });
    }

    return { order: confirmedOrder, payments: createdPayments, receipt };
  });

  return {
    order: result.order,
    payments: result.payments,
    receipt: result.receipt,
    changeDueCents,
  };
}

// Closing a session reconciles cash collected against recorded cash
// movements (SALE/DEPOSIT add, REFUND/PAID_OUT subtract, PAID_IN adds) so a
// discrepancy is visible rather than silently absorbed.
async function closeRegister({ registerSessionId, closingCashCents, notes, performedById }) {
  const session = await getOpenSession(registerSessionId);

  const movements = await prisma.cashMovement.findMany({ where: { registerSessionId } });
  const movementTotal = movements.reduce((sum, m) => {
    const sign = m.type === "REFUND" || m.type === "PAID_OUT" ? -1 : 1;
    return sum + sign * m.amountCents;
  }, 0);

  const expectedCashCents = session.openingCashCents + movementTotal;
  const discrepancyCents = closingCashCents - expectedCashCents;

  const updated = await prisma.registerSession.update({
    where: { id: registerSessionId },
    data: {
      status: "CLOSED",
      closingCashCents,
      expectedCashCents,
      discrepancyCents,
      closedAt: new Date(),
    },
    include: { register: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: performedById,
      action: "pos.register.close",
      entityType: "RegisterSession",
      entityId: registerSessionId,
      reasonCode: notes || null,
      metadata: { closingCashCents, expectedCashCents, discrepancyCents },
    },
  });

  return serializeSession(updated);
}

// A cashier who finds a register still OPEN from a previous shift (left
// stuck — not closed out correctly) can no longer force-close it themselves.
// Instead this flips the stuck session to PENDING_REOPEN_APPROVAL so a
// manager/admin reviews and either approves (closing it out for real) or
// denies (sending it back to OPEN) the request. The register stays
// unusable — openRegister() rejects both OPEN and PENDING_REOPEN_APPROVAL —
// until that happens.
async function requestReopen({ registerSessionId, requestedById }) {
  const session = await prisma.registerSession.findUnique({
    where: { id: registerSessionId },
    include: { register: true },
  });
  if (!session) throw new NotFoundError("Register session not found");
  if (session.status !== "OPEN") {
    throw new ConflictError("Only a stuck, currently-open register session can request reopen approval");
  }

  const updated = await prisma.registerSession.update({
    where: { id: registerSessionId },
    data: {
      status: "PENDING_REOPEN_APPROVAL",
      reopenRequestedById: requestedById,
      reopenRequestedAt: new Date(),
      reopenApprovedById: null,
      reopenApprovedAt: null,
      reopenDeniedAt: null,
      reopenDenialReason: null,
    },
    include: { register: { include: { location: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: requestedById,
      action: "pos.register.reopen.request",
      entityType: "RegisterSession",
      entityId: registerSessionId,
    },
  });

  return serializeSession(updated);
}

async function listPendingReopens() {
  const sessions = await prisma.registerSession.findMany({
    where: { status: "PENDING_REOPEN_APPROVAL" },
    include: { register: { include: { location: true } }, reopenRequestedBy: true },
    orderBy: { reopenRequestedAt: "asc" },
  });
  return sessions.map((session) => ({
    ...serializeSession(session),
    reopenRequestedByName: session.reopenRequestedBy
      ? `${session.reopenRequestedBy.firstName} ${session.reopenRequestedBy.lastName}`
      : null,
  }));
}

// Approving actually closes the stuck session out (same cash reconciliation
// as a normal close) so the register becomes available again. The manager
// supplies the counted drawer total just like a cashier would have, since
// nobody has reconciled this drawer yet.
async function approveReopen({ registerSessionId, closingCashCents, notes, performedById }) {
  const session = await prisma.registerSession.findUnique({ where: { id: registerSessionId } });
  if (!session) throw new NotFoundError("Register session not found");
  if (session.status !== "PENDING_REOPEN_APPROVAL") {
    throw new ConflictError("This register session is not awaiting reopen approval");
  }

  const movements = await prisma.cashMovement.findMany({ where: { registerSessionId } });
  const movementTotal = movements.reduce((sum, m) => {
    const sign = m.type === "REFUND" || m.type === "PAID_OUT" ? -1 : 1;
    return sum + sign * m.amountCents;
  }, 0);

  const expectedCashCents = session.openingCashCents + movementTotal;
  const discrepancyCents = closingCashCents - expectedCashCents;

  const updated = await prisma.registerSession.update({
    where: { id: registerSessionId },
    data: {
      status: "CLOSED",
      closingCashCents,
      expectedCashCents,
      discrepancyCents,
      closedAt: new Date(),
      reopenApprovedById: performedById,
      reopenApprovedAt: new Date(),
    },
    include: { register: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: performedById,
      action: "pos.register.reopen.approve",
      entityType: "RegisterSession",
      entityId: registerSessionId,
      reasonCode: notes || null,
      metadata: { closingCashCents, expectedCashCents, discrepancyCents },
    },
  });

  return serializeSession(updated);
}

// Denying sends the session back to OPEN rather than closing it — the
// manager is saying "don't just count this out, someone needs to physically
// look at this register" (e.g. the discrepancy claim seems off, or the
// stuck-open session needs investigating in person before it's reconciled).
async function denyReopen({ registerSessionId, reason, performedById }) {
  const session = await prisma.registerSession.findUnique({ where: { id: registerSessionId } });
  if (!session) throw new NotFoundError("Register session not found");
  if (session.status !== "PENDING_REOPEN_APPROVAL") {
    throw new ConflictError("This register session is not awaiting reopen approval");
  }

  const updated = await prisma.registerSession.update({
    where: { id: registerSessionId },
    data: {
      status: "OPEN",
      reopenDeniedAt: new Date(),
      reopenDenialReason: reason || null,
    },
    include: { register: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: performedById,
      action: "pos.register.reopen.deny",
      entityType: "RegisterSession",
      entityId: registerSessionId,
      reasonCode: reason || null,
    },
  });

  return serializeSession(updated);
}

// `paymentId` optionally attributes this refund to a specific original
// tender (populating the previously-unused Refund.paymentId) — falls back to
// orderId-only exactly as before when not specified.
async function refund({ registerSessionId, orderId, amountCents, reasonCode, notes, restock, paymentId, performedById }) {
  const session = await getOpenSession(registerSessionId);

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
  if (!order) throw new NotFoundError("Order not found");

  const result = await prisma.$transaction(async (tx) => {
    // Lock the order row before re-reading how much has already been
    // refunded, so two concurrent refund requests for the same order
    // serialize instead of both reading the same refundedSoFar snapshot and
    // both passing the cap check — without this lock, two refunds submitted
    // at the same time (a double-submit, or two staff ringing up the same
    // return) could each independently pass "refundedSoFar + amountCents <=
    // totalCents" and jointly refund more than was ever actually paid.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    const alreadyRefunded = await tx.refund.aggregate({
      where: { orderId },
      _sum: { amountCents: true },
    });
    const refundedSoFar = alreadyRefunded._sum.amountCents || 0;
    if (refundedSoFar + amountCents > order.totalCents) {
      throw new ConflictError("Refund amount would exceed the order total", {
        orderTotalCents: order.totalCents,
        alreadyRefundedCents: refundedSoFar,
        requestedCents: amountCents,
      });
    }

    const refundRecord = await tx.refund.create({
      data: {
        orderId,
        paymentId: paymentId || null,
        amountCents,
        reasonCode,
        notes,
        processedById: performedById,
      },
    });

    const totalRefunded = refundedSoFar + amountCents;
    const paymentStatus = totalRefunded >= order.totalCents ? "REFUNDED" : "PARTIALLY_PAID";

    await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });

    await tx.cashMovement.create({
      data: {
        registerSessionId,
        type: "REFUND",
        amountCents,
        notes: `Refund for order ${order.orderNumber}${notes ? ` — ${notes}` : ""}`,
      },
    });

    return refundRecord;
  });

  if (restock) {
    for (const line of order.lines) {
      const locationId = session.register.locationId;
      if (!locationId) continue;
      await inventoryService.adjustStock({
        variantId: line.variantId,
        locationId,
        type: "ADJUSTMENT_INCREASE",
        quantity: line.quantity,
        reasonCode: `refund:${reasonCode}`,
        performedById,
      });
    }
  }

  return result;
}

// Looks up one order with an outstanding balance by order number, receipt
// number, or customer phone (contains match — most recent match wins; same
// shape as posReturns.service.js's findOrderForReturn, the closest existing
// precedent for "find an order at the register by a few different IDs").
// Scoped to PARTIALLY_PAID/UNPAID — an already-PAID or REFUNDED order has
// nothing left to collect, and surfacing it here would just invite a
// cashier to double-collect on a settled sale.
async function findOrderWithBalance({ q }) {
  const query = String(q ?? "").trim();
  if (!query) throw new ConflictError("Search query is required");

  const order = await prisma.order.findFirst({
    where: {
      paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
      OR: [
        { orderNumber: { contains: query, mode: "insensitive" } },
        { receipts: { some: { receiptNumber: { contains: query, mode: "insensitive" } } } },
        { customer: { phone: { contains: query, mode: "insensitive" } } },
      ],
    },
    include: {
      lines: true,
      customer: true,
      payments: { where: { status: "SUCCEEDED" } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!order) throw new NotFoundError("No order with an outstanding balance matches that search");

  const paidSoFarCents = order.payments.reduce((sum, p) => sum + p.amountCents, 0);
  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      paymentStatus: order.paymentStatus,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      customer: order.customer
        ? {
            id: order.customer.id,
            firstName: order.customer.firstName,
            lastName: order.customer.lastName,
            email: order.customer.email,
            phone: order.customer.phone,
          }
        : null,
      lines: order.lines.map((l) => ({
        id: l.id,
        name: l.nameSnapshot,
        sku: l.skuSnapshot,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
      })),
      paidSoFarCents,
      balanceDueCents: Math.max(0, order.totalCents - paidSoFarCents),
    },
  };
}

// Collects an additional payment against an order that was left
// PARTIALLY_PAID or UNPAID (a deposit sale, or any other under-tendered
// sale) — the "pay down a pending balance" counterpart to refund() above.
// Never creates a new Order; always attaches to the existing one, exactly
// like ringSale attaching payments to the order it just created, just at a
// later register session. CARD is rejected for the same reason ringSale
// rejects it: no payment processor/terminal has been selected yet.
async function settleBalance({ registerSessionId, orderId, payments, performedById }) {
  if (payments.some((p) => p.method === "CARD")) {
    throw new ConflictError(
      "Card-present tender is not available yet — no payment processor or terminal model has been selected. Use cash or deposit."
    );
  }

  // Throws if the session doesn't exist or isn't OPEN — that check is this
  // call's only purpose here; unlike refund()'s use of the same helper,
  // settling a balance never touches stock/location, so the session object
  // itself isn't needed afterward.
  await getOpenSession(registerSessionId);

  // Explicit timeout, well above Prisma's 5s interactive-transaction
  // default: this transaction's round trips scale with how many payment
  // entries are being recorded (one Payment + possibly one CashMovement per
  // entry, plus the order lock/read, order update, and receipt create), and
  // on this project's remote dev database a handful of sequential round
  // trips can already approach the default on its own under load — observed
  // timing out in the full test suite even though the same test passes in
  // isolation. 20s gives real multi-entry settlements room without masking
  // a genuine hang.
  const result = await prisma.$transaction(
    async (tx) => {
      // Lock the order row before re-reading how much has already been
      // paid, so two concurrent settlement attempts for the same order (a
      // double-submit, or two cashiers both pulling it up) serialize
      // instead of both reading the same paidSoFar snapshot and jointly
      // overcollecting — the same race refund() above already guards
      // against on the refund side.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError("Order not found");
      if (!["PARTIALLY_PAID", "UNPAID"].includes(order.paymentStatus)) {
        throw new ConflictError(`This order is already ${order.paymentStatus.toLowerCase()} — there's nothing left to collect`, {
          paymentStatus: order.paymentStatus,
        });
      }

      const alreadyPaid = await tx.payment.aggregate({
        where: { orderId, status: "SUCCEEDED" },
        _sum: { amountCents: true },
      });
      const paidSoFarCents = alreadyPaid._sum.amountCents || 0;
      const balanceDueCents = Math.max(0, order.totalCents - paidSoFarCents);

      // Never trust frontend-computed totals: recompute from the payments
      // array itself, same rule ringSale applies to a brand-new sale.
      const totalTenderedCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
      const nonCashTenderedCents =
        totalTenderedCents - payments.filter((p) => p.method === "CASH").reduce((sum, p) => sum + p.amountCents, 0);
      if (nonCashTenderedCents > balanceDueCents) {
        throw new ConflictError("Non-cash payment amounts cannot exceed the remaining balance", {
          balanceDueCents,
          nonCashTenderedCents,
        });
      }

      // Only cash can overtender (to produce change). Mirrors ringSale's
      // own trim-the-last-cash-entry logic so a Payment row never records
      // more than what was actually applied to the balance.
      const changeDueCents = Math.max(0, totalTenderedCents - balanceDueCents);
      const appliedPayments =
        changeDueCents > 0
          ? (() => {
              let remainingTrim = changeDueCents;
              const trimmed = [];
              for (let i = payments.length - 1; i >= 0; i--) {
                const entry = payments[i];
                if (entry.method === "CASH" && remainingTrim > 0) {
                  const cut = Math.min(remainingTrim, entry.amountCents);
                  remainingTrim -= cut;
                  if (entry.amountCents - cut > 0) {
                    trimmed.unshift({ ...entry, amountCents: entry.amountCents - cut });
                  }
                } else {
                  trimmed.unshift(entry);
                }
              }
              return trimmed;
            })()
          : payments;

      const createdPayments = await createPaymentEntries(tx, {
        orderId,
        registerSessionId,
        payments: appliedPayments,
        customerId: order.customerId,
        performedById,
      });

      const newTotalPaidCents = paidSoFarCents + appliedPayments.reduce((sum, p) => sum + p.amountCents, 0);
      const paymentStatus = newTotalPaidCents >= order.totalCents ? "PAID" : "PARTIALLY_PAID";

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus },
        include: {
          lines: true,
          customer: true,
          payments: true,
          salesAttributions: { include: { user: { select: { firstName: true, lastName: true } } } },
          shippingAddress: true,
          billingAddress: true,
        },
      });

      const receiptNumber = await nextReceiptNumber(tx);
      const receipt = await tx.receipt.create({
        data: { registerSessionId, orderId, receiptNumber },
      });

      // `payments` is every payment ever recorded on this order (the
      // original deposit plus this settlement), not just what was
      // collected just now — ReceiptView.jsx sums `payments` to show total
      // paid, and that must reflect the order's full payment history, the
      // same way a brand-new sale's single batch of payments already does
      // for ringSale. Callers that specifically want "what was collected
      // in this transaction" get that separately via `collectedPayments`.
      return {
        order: updatedOrder,
        payments: updatedOrder.payments,
        collectedPayments: createdPayments,
        receipt,
        changeDueCents,
      };
    },
    { timeout: 20000 }
  );

  return result;
}

module.exports = {
  openRegister,
  closeRegister,
  requestReopen,
  listPendingReopens,
  approveReopen,
  denyReopen,
  ringSale,
  refund,
  findOrderWithBalance,
  settleBalance,
  createPaymentEntries,
  serializeSession,
};
