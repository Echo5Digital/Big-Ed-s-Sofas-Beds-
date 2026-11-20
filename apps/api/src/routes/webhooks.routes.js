const express = require("express");
const { prisma } = require("@big-eds/database");
const { WebhooksHelper } = require("square");
const { env } = require("../lib/env");
const { asyncHandler } = require("../middleware/asyncHandler");
const { markPaymentSucceeded, markPaymentFailed } = require("../services/payments.service");

const router = express.Router();

// This route's own full URL, exactly as configured on the Square webhook
// subscription — Square's signature is HMAC'd over notificationUrl + the
// raw request body, so this string must match byte-for-byte or every
// signature check fails (see WebhooksHelper.verifySignature).
const WEBHOOK_URL = `${env.publicUrl}/api/webhooks/square`;

// Square requires the raw, unparsed (string) request body to verify the
// webhook signature — express.raw() here must run instead of (not after)
// the global express.json() mounted in app.js, so this route is registered
// before that global parser.
router.post(
  "/square",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-square-hmacsha256-signature"];
    const requestBody = req.body.toString("utf8");

    let isValid;
    try {
      isValid = await WebhooksHelper.verifySignature({
        requestBody,
        signatureHeader: signature,
        signatureKey: env.squareWebhookSignatureKey,
        notificationUrl: WEBHOOK_URL,
      });
    } catch (err) {
      return res.status(400).json({ error: { message: `Webhook signature verification failed: ${err.message}` } });
    }
    if (!isValid) {
      return res.status(400).json({ error: { message: "Webhook signature verification failed" } });
    }

    const event = JSON.parse(requestBody);

    // Record the event before handling it. eventId is unique — a duplicate
    // delivery (Square retries on anything but a 2xx) hits a P2002 conflict
    // here. That only means this exact event row already exists, NOT that it
    // was necessarily fully handled: if a prior delivery crashed partway
    // through handlePaymentUpdated (e.g. a transient DB error converting one
    // of several reservations), processedAt was never set, and
    // short-circuiting here unconditionally would permanently strand the
    // order — Square believes the event was acknowledged and will not retry
    // again, but the order's payment/fulfillment status and remaining
    // reservations were never finished. So: only skip re-processing when the
    // existing row shows the event was already fully handled (processedAt
    // set); otherwise fall through and (re-)run the handler. The handler is
    // safe to re-run — it only acts on reservations still ACTIVE, so an
    // already-converted/released reservation from a partial prior attempt is
    // simply skipped, not re-applied.
    try {
      await prisma.providerEvent.create({
        data: {
          providerName: "square",
          eventId: event.event_id,
          eventType: event.type,
          payload: event,
        },
      });
    } catch (err) {
      if (err?.code === "P2002") {
        const existing = await prisma.providerEvent.findUnique({ where: { eventId: event.event_id } });
        if (existing?.processedAt) {
          return res.status(200).json({ received: true, duplicate: true });
        }
        // Fall through to (re-)run the handler below for this not-yet-fully-processed event.
      } else {
        throw err;
      }
    }

    if (event.type === "payment.updated") {
      await handlePaymentUpdated(event.data.object.payment);
    }

    await prisma.providerEvent.update({
      where: { eventId: event.event_id },
      data: { processedAt: new Date() },
    });

    res.status(200).json({ received: true });
  })
);

// Square uses one event type for every payment status transition (unlike
// object's own status field instead. APPROVED/PENDING (not yet a final
// outcome) are intentionally left alone here; only a terminal COMPLETED or
// FAILED/CANCELED is acted on.
async function handlePaymentUpdated(squarePayment) {
  let payment = await prisma.payment.findFirst({ where: { providerRef: squarePayment.id } });
  if (!payment && (squarePayment.reference_id || squarePayment.referenceId)) {
    const orderId = squarePayment.reference_id || squarePayment.referenceId;
    payment = await prisma.payment.findFirst({ where: { orderId } });
    if (payment && !payment.providerRef) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerRef: squarePayment.id },
      });
    }
  }
  if (!payment) return;

  if (squarePayment.status === "COMPLETED") {
    if (payment.status === "SUCCEEDED") return; // already handled by the synchronous /pay response
    await markPaymentSucceeded(payment.id, payment.orderId);
  } else if (squarePayment.status === "FAILED" || squarePayment.status === "CANCELED") {
    if (payment.status === "FAILED") return; // already handled by the synchronous /pay response
    await markPaymentFailed(payment.id, payment.orderId, "Payment failed");
  }
}

module.exports = router;
module.exports.handlePaymentUpdated = handlePaymentUpdated;
