const { prisma } = require("@big-eds/database");
const { ConflictError, NotFoundError } = require("../lib/errors");
const { createWithSequentialNumber } = require("../lib/sequentialNumber");
const inventoryService = require("./inventory.service");
const storeCreditService = require("./storeCredit.service");
const posCustomersService = require("./posCustomers.service");

async function nextOrderNumber(tx) {
  const count = await tx.order.count();
  return `BE-${100000 + count + 1}`;
}

async function nextReceiptNumber(tx) {
  const count = await tx.receipt.count();
  return `RCPT-${100000 + count + 1}`;
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
  discountCents,
  discountReasonCode,
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

  if (discountCents > subtotalCents) {
    throw new ConflictError("Discount cannot exceed the order subtotal", { subtotalCents, discountCents });
  }
  const totalCents = subtotalCents - (discountCents || 0);

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

  const order = await createWithSequentialNumber(() =>
    prisma.$transaction(async (tx) => {
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
          discountCents: discountCents || 0,
          totalCents,
          lines: {
            create: lines.map((l) => {
              const variant = variantById.get(l.variantId);
              return {
                variantId: variant.id,
                skuSnapshot: variant.sku,
                nameSnapshot: `${variant.product.name} — ${variant.name}`,
                quantity: l.quantity,
                unitPriceCents: variant.priceCents,
                lineTotalCents: variant.priceCents * l.quantity,
              };
            }),
          },
        },
        include: { lines: true, customer: true },
      });
    })
  );

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

  const result = await createWithSequentialNumber(() =>
    prisma.$transaction(async (tx) => {
      const createdPayments = await createPaymentEntries(tx, {
        orderId: order.id,
        registerSessionId,
        payments: appliedPayments,
        customerId,
        performedById,
      });

      const paymentStatus =
        totalTenderedCents >= totalCents ? "PAID" : totalTenderedCents > 0 ? "PARTIALLY_PAID" : "UNPAID";

      const confirmedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CONFIRMED",
          fulfillmentStatus: "READY",
          paymentStatus,
        },
        include: { lines: true, customer: true, payments: true },
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
            metadata: { discountCents, subtotalCents },
          },
        });
      }

      return { order: confirmedOrder, payments: createdPayments, receipt };
    })
  );

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

module.exports = {
  openRegister,
  closeRegister,
  requestReopen,
  listPendingReopens,
  approveReopen,
  denyReopen,
  ringSale,
  refund,
  createPaymentEntries,
  serializeSession,
};
