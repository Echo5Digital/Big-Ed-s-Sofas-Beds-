const express = require("express");
const { prisma } = require("@big-eds/database");
const { stripe } = require("../lib/stripe");
const { env } = require("../lib/env");
const { asyncHandler } = require("../middleware/asyncHandler");
const inventoryService = require("../services/inventory.service");

const router = express.Router();

// Stripe requires the raw, unparsed request body to verify the webhook
// signature — express.raw() here must run instead of (not after) the
// global express.json() mounted in app.js, so this route is registered
// before that global parser.
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
    } catch (err) {
      return res.status(400).json({ error: { message: `Webhook signature verification failed: ${err.message}` } });
    }

    // Record the event before handling it. eventId is unique — a duplicate
    // delivery (Stripe retries on anything but a 2xx) hits a P2002 conflict
    // here. That only means this exact event row already exists, NOT that it
    // was necessarily fully handled: if a prior delivery crashed partway
    // through handlePaymentSucceeded/handlePaymentFailed (e.g. a transient DB
    // error converting one of several reservations), processedAt was never
    // set, and short-circuiting here unconditionally would permanently strand
    // the order — Stripe believes the event was acknowledged and will not
    // retry again, but the order's payment/fulfillment status and remaining
    // reservations were never finished. So: only skip re-processing when the
    // existing row shows the event was already fully handled (processedAt
    // set); otherwise fall through and (re-)run the handler. Both handlers
    // are safe to re-run — they only act on reservations still ACTIVE, so an
    // already-converted/released reservation from a partial prior attempt is
    // simply skipped, not re-applied.
    try {
      await prisma.providerEvent.create({
        data: {
          providerName: "stripe",
          eventId: event.id,
          eventType: event.type,
          payload: event,
        },
      });
    } catch (err) {
      if (err?.code === "P2002") {
        const existing = await prisma.providerEvent.findUnique({ where: { eventId: event.id } });
        if (existing?.processedAt) {
          return res.status(200).json({ received: true, duplicate: true });
        }
        // Fall through to (re-)run the handler below for this not-yet-fully-processed event.
      } else {
        throw err;
      }
    }

    if (event.type === "payment_intent.succeeded") {
      await handlePaymentSucceeded(event.data.object);
    } else if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailed(event.data.object);
    }

    await prisma.providerEvent.update({
      where: { eventId: event.id },
      data: { processedAt: new Date() },
    });

    res.status(200).json({ received: true });
  })
);

async function handlePaymentSucceeded(paymentIntent) {
  const payment = await prisma.payment.findFirst({ where: { providerRef: paymentIntent.id } });
  if (!payment) return;

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });

  const reservations = await prisma.reservation.findMany({
    where: { orderId: payment.orderId, status: "ACTIVE" },
  });
  for (const reservation of reservations) {
    await inventoryService.convertReservationToSale(reservation.id, { referenceId: payment.orderId });
  }

  await prisma.order.update({
    where: { id: payment.orderId },
    data: { paymentStatus: "PAID", fulfillmentStatus: "READY" },
  });
}

async function handlePaymentFailed(paymentIntent) {
  const payment = await prisma.payment.findFirst({ where: { providerRef: paymentIntent.id } });
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      failureReason: paymentIntent.last_payment_error?.message || "Payment failed",
    },
  });

  const reservations = await prisma.reservation.findMany({
    where: { orderId: payment.orderId, status: "ACTIVE" },
  });
  for (const reservation of reservations) {
    await inventoryService.releaseReservation(reservation.id);
  }

  await prisma.order.update({ where: { id: payment.orderId }, data: { status: "CANCELED" } });
}

module.exports = router;
module.exports.handlePaymentSucceeded = handlePaymentSucceeded;
module.exports.handlePaymentFailed = handlePaymentFailed;
