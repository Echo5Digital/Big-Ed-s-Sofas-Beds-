const { prisma } = require("@big-eds/database");
const { ConflictError, NotFoundError } = require("../lib/errors");
const { createWithSequentialNumber } = require("../lib/sequentialNumber");
const inventoryService = require("./inventory.service");

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

// Rings up a walk-in sale: prices the lines server-side from live variant
// data (never trusts client-sent prices), reserves stock, immediately
// converts the reservation to a sale (a POS cashier completes checkout in
// one motion, unlike the online cart), and creates the Payment + Receipt
// records. CASH and DEPOSIT are real, working tenders backed by a
// CashMovement on the register session; CARD is rejected — no payment
// processor/terminal has been selected yet (see
// docs/requirements/open-questions.md) and this function must never fabricate
// a successful card charge.
async function ringSale({
  registerSessionId,
  lines,
  tenderMethod,
  tenderedCents,
  depositAmountCents,
  discountCents,
  discountReasonCode,
  customerInput,
  performedById,
}) {
  if (tenderMethod === "CARD") {
    throw new ConflictError(
      "Card-present tender is not available yet — no payment processor or terminal model has been selected. Use cash or deposit."
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
  const saleAmountCents = tenderMethod === "DEPOSIT" ? depositAmountCents : totalCents;

  if (tenderMethod === "DEPOSIT" && (!depositAmountCents || depositAmountCents > totalCents)) {
    throw new ConflictError("Deposit amount must be greater than zero and not exceed the order total");
  }
  if (tenderedCents < saleAmountCents) {
    throw new ConflictError("Tendered amount is less than the amount due", {
      amountDueCents: saleAmountCents,
      tenderedCents,
    });
  }

  let customerId = null;
  if (customerInput?.email) {
    const customer = await prisma.customer.upsert({
      where: { email: customerInput.email },
      update: { firstName: customerInput.firstName, lastName: customerInput.lastName, phone: customerInput.phone },
      create: customerInput,
    });
    customerId = customer.id;
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

  const changeDueCents = tenderMethod === "CASH" ? tenderedCents - saleAmountCents : 0;

  const result = await createWithSequentialNumber(() =>
    prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          method: tenderMethod,
          status: "SUCCEEDED",
          amountCents: saleAmountCents,
        },
      });

      const paymentStatus = tenderMethod === "DEPOSIT" && saleAmountCents < totalCents ? "PARTIALLY_PAID" : "PAID";

      const confirmedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CONFIRMED",
          fulfillmentStatus: "READY",
          paymentStatus,
        },
        include: { lines: true, customer: true, payments: true },
      });

      await tx.cashMovement.create({
        data: {
          registerSessionId,
          type: tenderMethod === "DEPOSIT" ? "DEPOSIT" : "SALE",
          amountCents: saleAmountCents,
          notes: `Order ${confirmedOrder.orderNumber}`,
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
            metadata: { discountCents, subtotalCents },
          },
        });
      }

      return { order: confirmedOrder, payment, receipt };
    })
  );

  return {
    order: result.order,
    payment: result.payment,
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

async function refund({ registerSessionId, orderId, amountCents, reasonCode, notes, restock, performedById }) {
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
  serializeSession,
};
