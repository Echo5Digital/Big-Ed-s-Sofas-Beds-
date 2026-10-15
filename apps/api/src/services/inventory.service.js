const { prisma } = require("@big-eds/database");
const { RESERVATION_TTL_MINUTES } = require("@big-eds/config");
const { ConflictError, NotFoundError } = require("../lib/errors");

// All mutating stock operations run inside a single Prisma transaction and
// take a row-level lock (SELECT ... FOR UPDATE) on the balance row before
// checking availability, so concurrent requests for the same row block on
// the lock instead of both reading a stale snapshot and both passing the
// availability check. This is what prevents the "last unit sold twice"
// failure the kickoff plan calls out explicitly — a plain findUnique here
// (without FOR UPDATE) would let two concurrent transactions both read
// reserved=0, both pass the check, and both commit their increment.

async function getOrCreateBalance(tx, variantId, locationId) {
  const [existing] = await tx.$queryRaw`
    SELECT * FROM "StockBalance"
    WHERE "variantId" = ${variantId} AND "locationId" = ${locationId}
    FOR UPDATE
  `;
  if (existing) return existing;
  // Row doesn't exist yet — create it, then lock it so a concurrent
  // first-reservation race still serializes correctly.
  await tx.stockBalance.create({ data: { variantId, locationId } });
  const [created] = await tx.$queryRaw`
    SELECT * FROM "StockBalance"
    WHERE "variantId" = ${variantId} AND "locationId" = ${locationId}
    FOR UPDATE
  `;
  return created;
}

function availableToSell(balance) {
  return balance.onHand - balance.reserved - balance.quarantined;
}

async function adjustStock({ variantId, locationId, type, quantity, reasonCode, performedById }) {
  return prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(tx, variantId, locationId);

    const delta = type === "ADJUSTMENT_INCREASE" ? quantity : -quantity;
    const nextOnHand = balance.onHand + delta;

    if (nextOnHand < 0) {
      throw new ConflictError("Adjustment would result in negative on-hand stock", {
        currentOnHand: balance.onHand,
        requestedDelta: delta,
      });
    }

    await tx.stockBalance.update({
      where: { id: balance.id },
      data: { onHand: nextOnHand },
    });

    const movement = await tx.stockMovement.create({
      data: {
        variantId,
        locationId,
        type,
        quantity,
        reasonCode,
        referenceType: "ManualAdjustment",
        performedById,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: performedById,
        action: "inventory.adjust",
        entityType: "StockMovement",
        entityId: movement.id,
        reasonCode,
        metadata: { variantId, locationId, type, quantity },
      },
    });

    return movement;
  });
}

async function transferStock({ variantId, fromLocationId, toLocationId, quantity, notes, performedById }) {
  if (fromLocationId === toLocationId) {
    throw new ConflictError("Source and destination locations must differ");
  }

  return prisma.$transaction(async (tx) => {
    const fromBalance = await getOrCreateBalance(tx, variantId, fromLocationId);

    if (availableToSell(fromBalance) < quantity) {
      throw new ConflictError("Insufficient available stock at source location", {
        availableToSell: availableToSell(fromBalance),
        requested: quantity,
      });
    }

    const toBalance = await getOrCreateBalance(tx, variantId, toLocationId);

    await tx.stockBalance.update({
      where: { id: fromBalance.id },
      data: { onHand: { decrement: quantity } },
    });
    await tx.stockBalance.update({
      where: { id: toBalance.id },
      data: { onHand: { increment: quantity } },
    });

    const transfer = await tx.transfer.create({
      data: {
        variantId,
        fromLocationId,
        toLocationId,
        quantity,
        status: "COMPLETED",
        notes,
        completedAt: new Date(),
      },
    });

    await tx.stockMovement.createMany({
      data: [
        {
          variantId,
          locationId: fromLocationId,
          type: "TRANSFER_OUT",
          quantity,
          referenceType: "Transfer",
          referenceId: transfer.id,
          performedById,
        },
        {
          variantId,
          locationId: toLocationId,
          type: "TRANSFER_IN",
          quantity,
          referenceType: "Transfer",
          referenceId: transfer.id,
          performedById,
        },
      ],
    });

    await tx.auditLog.create({
      data: {
        userId: performedById,
        action: "inventory.transfer",
        entityType: "Transfer",
        entityId: transfer.id,
        metadata: { variantId, fromLocationId, toLocationId, quantity },
      },
    });

    return transfer;
  });
}

// Reserves stock for an order (online checkout hold or POS deposit). Throws
// ConflictError if available-to-sell can't cover the request — caller is
// responsible for surfacing that as an out-of-stock condition rather than
// silently overselling.
async function reserveStock({ variantId, locationId, quantity, orderId, ttlMinutes = RESERVATION_TTL_MINUTES }) {
  return prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(tx, variantId, locationId);

    if (availableToSell(balance) < quantity) {
      throw new ConflictError("Insufficient stock available to reserve", {
        availableToSell: availableToSell(balance),
        requested: quantity,
      });
    }

    await tx.stockBalance.update({
      where: { id: balance.id },
      data: { reserved: { increment: quantity } },
    });

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const reservation = await tx.reservation.create({
      data: { variantId, locationId, quantity, orderId, expiresAt, status: "ACTIVE" },
    });

    return reservation;
  });
}

async function releaseReservation(reservationId) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundError("Reservation not found");
    if (reservation.status !== "ACTIVE") return reservation;

    const balance = await getOrCreateBalance(tx, reservation.variantId, reservation.locationId);
    await tx.stockBalance.update({
      where: { id: balance.id },
      data: { reserved: { decrement: reservation.quantity } },
    });

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "RELEASED" },
    });

    await tx.stockMovement.create({
      data: {
        variantId: reservation.variantId,
        locationId: reservation.locationId,
        type: "RESERVATION_RELEASE",
        quantity: reservation.quantity,
        referenceType: "Reservation",
        referenceId: reservation.id,
      },
    });

    return updated;
  });
}

// Converts an active reservation into a final sale: decrements onHand and
// reserved together in one transaction, so the reserved unit is never
// double-counted or left dangling.
async function convertReservationToSale(reservationId, { performedById, referenceId } = {}) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundError("Reservation not found");
    if (reservation.status !== "ACTIVE") {
      throw new ConflictError(`Reservation is not active (status: ${reservation.status})`);
    }

    const balance = await getOrCreateBalance(tx, reservation.variantId, reservation.locationId);

    await tx.stockBalance.update({
      where: { id: balance.id },
      data: {
        onHand: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    });

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "CONVERTED" },
    });

    await tx.stockMovement.create({
      data: {
        variantId: reservation.variantId,
        locationId: reservation.locationId,
        type: "SALE",
        quantity: reservation.quantity,
        referenceType: "Order",
        referenceId: referenceId ?? reservation.orderId,
        performedById,
      },
    });

    return updated;
  });
}

// Lazily expire reservations past their TTL. Called before any read that
// needs an accurate available-to-sell figure (catalog reads, PDP, checkout).
async function expireStaleReservations() {
  const stale = await prisma.reservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
  });

  for (const reservation of stale) {
    await prisma.$transaction(async (tx) => {
      const balance = await getOrCreateBalance(tx, reservation.variantId, reservation.locationId);
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { reserved: { decrement: reservation.quantity } },
      });
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "EXPIRED" },
      });
      await tx.stockMovement.create({
        data: {
          variantId: reservation.variantId,
          locationId: reservation.locationId,
          type: "RESERVATION_RELEASE",
          quantity: reservation.quantity,
          referenceType: "Reservation",
          referenceId: reservation.id,
          reasonCode: "expired",
        },
      });
    });
  }

  return stale.length;
}

module.exports = {
  adjustStock,
  transferStock,
  reserveStock,
  releaseReservation,
  convertReservationToSale,
  expireStaleReservations,
  availableToSell,
};
