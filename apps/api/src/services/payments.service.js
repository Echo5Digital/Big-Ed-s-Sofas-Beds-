const { prisma } = require("@big-eds/database");
const inventoryService = require("./inventory.service");

// Shared by both the synchronous POST /checkout/:id/pay response
// (orders.routes.js) and the Square webhook (webhooks.routes.js) — whichever
// observes the outcome first wins; the other is a safe no-op because both
// functions only ever act on reservations still ACTIVE, never re-apply an
// already-converted/released one. Never assume terminal pending means paid:
// callers must only invoke markPaymentSucceeded once Square's own response
// (synchronous CreatePayment result or payment.updated webhook) says
// COMPLETED.

async function markPaymentSucceeded(paymentId, orderId) {
  await prisma.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED" } });

  const activeReservations = await prisma.reservation.findMany({ where: { orderId, status: "ACTIVE" } });
  for (const reservation of activeReservations) {
    await inventoryService.convertReservationToSale(reservation.id, { referenceId: orderId });
  }

  // fulfillmentStatus is deliberately left untouched here — it stays at
  // RESERVED (displayStatus "Ordered") until staff manually progress it
  // through PROCESSING -> READY -> PICKED_UP/DELIVERED via the admin
  // order-status endpoint (see orderStatus.service.js). Payment succeeding
  // is not a fulfillment milestone; jumping straight to READY here used to
  // make every freshly-paid storefront order display as "Ready" instead of
  // "Ordered" the moment checkout completed.
  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
}

async function markPaymentFailed(paymentId, orderId, failureReason) {
  await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failureReason } });

  const activeReservations = await prisma.reservation.findMany({ where: { orderId, status: "ACTIVE" } });
  for (const reservation of activeReservations) {
    await inventoryService.releaseReservation(reservation.id);
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELED" } });
}

module.exports = { markPaymentSucceeded, markPaymentFailed };
