// Pure, Prisma-free derivation of the staff-facing unified order status from
// Order.status / paymentStatus / fulfillmentStatus — see
// docs/workflows/order-lifecycle.md for why these three fields are never
// normally conflated. This module is the one deliberate, display-only
// exception: it reads all three (plus channel) to produce a single label for
// staff/customers, and is also the one place that knows how to translate a
// chosen label back into the real field writes a staff-initiated status
// change should perform. No Prisma import here by design — callers pass in
// the plain order fields they already have.

const ONLINE_TARGET_STATUSES = ["Ordered", "Processing", "Ready", "Completed"];
const POS_TARGET_STATUSES = ["Ordered", "Ready", "Completed"];

// order: { channel, status, paymentStatus, fulfillmentStatus }
function computeOrderDisplayStatus(order) {
  if (order.status === "CANCELED") return "Canceled";

  if (order.channel === "POS") {
    // Checked before anything else: a deposit (balance still owed) always
    // reads as "Draft" regardless of how far fulfillment has progressed —
    // matches the business rule that a partially-paid POS sale is not yet a
    // real order until the balance is settled.
    if (order.paymentStatus === "PARTIALLY_PAID") return "Draft";
    if (["PICKED_UP", "DELIVERED"].includes(order.fulfillmentStatus)) return "Completed";
    if (order.fulfillmentStatus === "READY") return "Ready";
    if (order.paymentStatus === "PAID" && order.fulfillmentStatus === "RESERVED") return "Ordered";
    // Falls through for any other combination (e.g. still mid-ringSale,
    // UNALLOCATED/UNPAID) — treated as "Draft" rather than throwing, since
    // the admin list/detail views must always render *something* even for
    // an order that hasn't finished its own creation transaction yet.
    return "Draft";
  }

  // ONLINE
  if (["PICKED_UP", "DELIVERED"].includes(order.fulfillmentStatus)) return "Completed";
  if (order.fulfillmentStatus === "READY") return "Ready";
  if (order.fulfillmentStatus === "PROCESSING") return "Processing";
  if (order.fulfillmentStatus === "RESERVED") return "Ordered";
  // UNALLOCATED (pre-reservation-confirm) has no distinct label in the
  // approved four-state online ladder — nearest honest label is "Ordered"
  // since the order exists but hasn't yet reached RESERVED.
  return "Ordered";
}

// The *selectable* targets for a manual status change — narrower than what
// can be *displayed*. "Draft" and "Canceled" are deliberately excluded from
// both lists: Draft is a read of payment state (reversing it is
// settleBalance/refund's job, not this endpoint's), and Canceled is a
// separate, higher-stakes action with its own cross-cutting effects
// (releasing reservations, etc.) this endpoint never performs.
function legalTargetStatusesForChannel(channel) {
  return channel === "POS" ? POS_TARGET_STATUSES : ONLINE_TARGET_STATUSES;
}

// Translates a chosen unified label into the real Order field(s) to write.
// Takes the whole order (not just channel) because resolving "Completed"
// needs fulfillmentMethod. Throws if displayStatus isn't legal for this
// channel — callers (the PATCH route) are expected to have already
// validated this via legalTargetStatusesForChannel, but this function
// re-asserts it as its own invariant rather than trusting the caller.
function resolveOrderStatusFieldWrites(order, displayStatus) {
  const legal = legalTargetStatusesForChannel(order.channel);
  if (!legal.includes(displayStatus)) {
    throw new Error(`"${displayStatus}" is not a valid status for a ${order.channel} order`);
  }

  if (displayStatus === "Completed") {
    // Delivery orders complete as DELIVERED; everything else (in-store
    // pickup, POS, or a plain in-store sale) completes as PICKED_UP.
    return { fulfillmentStatus: order.fulfillmentMethod === "DELIVERY" ? "DELIVERED" : "PICKED_UP" };
  }
  if (displayStatus === "Ready") return { fulfillmentStatus: "READY" };

  if (order.channel === "POS") {
    // Only remaining POS target is "Ordered" — moving a deposit sale
    // forward here also marks it PAID, since "Ordered" at this fulfillment
    // step means the balance is settled (matches the Draft rule above:
    // Draft is defined as PARTIALLY_PAID, so leaving this channel's Draft
    // state means payment is no longer partial).
    return { paymentStatus: "PAID", fulfillmentStatus: "RESERVED" };
  }

  // ONLINE
  if (displayStatus === "Processing") return { fulfillmentStatus: "PROCESSING" };
  return { fulfillmentStatus: "RESERVED" }; // "Ordered"
}

// The inverse of computeOrderDisplayStatus: a Prisma where-clause matching
// every order whose computed label equals displayStatus, across both
// channels at once (the admin orders list filters without a channel
// restriction) — mirrors that function's branches exactly rather than
// re-deriving the rule, so a filtered list can never disagree with what the
// row's own badge shows. Throws on an unrecognized label; callers validate
// against this same five-value list (Ordered/Processing/Ready/Completed/
// Canceled) before calling.
function orderWhereForDisplayStatus(displayStatus) {
  // Both of computeOrderDisplayStatus's own short-circuits, reproduced as
  // negative conditions: CANCELED always wins regardless of channel, and a
  // POS order's own PARTIALLY_PAID deposit state always reads as Draft
  // regardless of fulfillmentStatus (see that function) — so every bucket
  // below except Canceled itself must also exclude a POS PARTIALLY_PAID
  // order, or e.g. a Draft deposit sitting at fulfillmentStatus READY would
  // wrongly match the "Ready" filter too.
  const notCanceled = { status: { not: "CANCELED" } };
  const notPosDraft = { NOT: { channel: "POS", paymentStatus: "PARTIALLY_PAID" } };
  const base = { AND: [notCanceled, notPosDraft] };

  switch (displayStatus) {
    case "Canceled":
      return { status: "CANCELED" };
    case "Completed":
      return { ...base, fulfillmentStatus: { in: ["PICKED_UP", "DELIVERED"] } };
    case "Ready":
      return { ...base, fulfillmentStatus: "READY" };
    case "Processing":
      // POS has no Processing rung (see computeOrderDisplayStatus) — scoping
      // to ONLINE here keeps this filter from ever matching a POS order no
      // admin would recognize as "Processing".
      return { ...base, channel: "ONLINE", fulfillmentStatus: "PROCESSING" };
    case "Ordered":
      // Channel-dependent, same as computeOrderDisplayStatus: POS only
      // reads as Ordered once PAID (a PARTIALLY_PAID deposit reads as Draft
      // instead, already excluded by notPosDraft above), while ONLINE reads
      // as Ordered for either pre-reservation (UNALLOCATED) or reserved
      // (RESERVED).
      return {
        ...base,
        OR: [
          { channel: "POS", paymentStatus: "PAID", fulfillmentStatus: "RESERVED" },
          { channel: "ONLINE", fulfillmentStatus: { in: ["UNALLOCATED", "RESERVED"] } },
        ],
      };
    default:
      throw new Error(`"${displayStatus}" is not a filterable order status`);
  }
}

module.exports = {
  computeOrderDisplayStatus,
  legalTargetStatusesForChannel,
  resolveOrderStatusFieldWrites,
  orderWhereForDisplayStatus,
};
