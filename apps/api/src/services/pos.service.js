const { prisma } = require("@big-eds/database");
const { ConflictError, NotFoundError } = require("../lib/errors");
const inventoryService = require("./inventory.service");

// POS sales reserve and convert in the same request (a cashier completes the
// sale immediately, unlike online checkout's held cart), so the reservation
// TTL only needs to bridge the reserve -> convert gap within one transaction.
const POS_RESERVATION_TTL_MINUTES = 5;

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
    status: session.status,
    openingCashCents: session.openingCashCents,
    closingCashCents: session.closingCashCents,
    expectedCashCents: session.expectedCashCents,
    discrepancyCents: session.discrepancyCents,
    openedById: session.openedById,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
  };
}

async function openRegister({ registerId, openingCashCents, openedById }) {
  const register = await prisma.register.findUnique({ where: { id: registerId } });
  if (!register) throw new NotFoundError("Register not found");
  if (!register.isActive) throw new ConflictError("Register is not active");

  const existingOpenSession = await prisma.registerSession.findFirst({
    where: { registerId, status: "OPEN" },
  });
  if (existingOpenSession) {
    throw new ConflictError("Register already has an open session", {
      registerSessionId: existingOpenSession.id,
    });
  }

  const session = await prisma.registerSession.create({
    data: { registerId, openedById, openingCashCents, status: "OPEN" },
    include: { register: true },
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
async function ringSale({ registerSessionId, lines, tenderMethod, tenderedCents, depositAmountCents, customerInput, performedById }) {
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
  const saleAmountCents = tenderMethod === "DEPOSIT" ? depositAmountCents : subtotalCents;

  if (tenderMethod === "DEPOSIT" && (!depositAmountCents || depositAmountCents > subtotalCents)) {
    throw new ConflictError("Deposit amount must be greater than zero and not exceed the order subtotal");
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

  const order = await prisma.$transaction(async (tx) => {
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
        totalCents: subtotalCents,
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
  });

  // Reserve-then-convert per line, each its own transaction (same pattern as
  // online checkout) so concurrent POS/web sales serialize on the stock
  // balance row rather than racing on a stale read.
  const reservationFailures = [];
  const convertedLineVariantIds = [];
  for (const line of lines) {
    try {
      const reservation = await inventoryService.reserveStock({
        variantId: line.variantId,
        locationId,
        quantity: line.quantity,
        orderId: order.id,
        ttlMinutes: POS_RESERVATION_TTL_MINUTES,
      });
      await inventoryService.convertReservationToSale(reservation.id, {
        performedById,
        referenceId: order.id,
      });
      convertedLineVariantIds.push(line.variantId);
    } catch {
      reservationFailures.push(line.variantId);
      break;
    }
  }

  if (reservationFailures.length > 0) {
    // Compensate any lines that already converted before cancelling the
    // order — a sale that's half rung up must never be left ambiguous.
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

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        method: tenderMethod,
        status: "SUCCEEDED",
        amountCents: saleAmountCents,
      },
    });

    const paymentStatus = tenderMethod === "DEPOSIT" && saleAmountCents < subtotalCents ? "PARTIALLY_PAID" : "PAID";

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

    return { order: confirmedOrder, payment, receipt };
  });

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

async function refund({ registerSessionId, orderId, amountCents, reasonCode, notes, restock, performedById }) {
  const session = await getOpenSession(registerSessionId);

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
  if (!order) throw new NotFoundError("Order not found");

  const alreadyRefunded = await prisma.refund.aggregate({
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

  const result = await prisma.$transaction(async (tx) => {
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
  ringSale,
  refund,
  serializeSession,
};
