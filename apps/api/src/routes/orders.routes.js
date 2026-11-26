const express = require("express");
const { prisma } = require("@big-eds/database");
const { checkoutCreateSchema, checkoutPaySchema, orderStatusUpdateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError, ApiError } = require("../lib/errors");
const inventoryService = require("../services/inventory.service");
const { saveCheckoutDeliveryAddress } = require("../services/orders.service");
const {
  computeOrderDisplayStatus,
  legalTargetStatusesForChannel,
  resolveOrderStatusFieldWrites,
  orderWhereForDisplayStatus,
} = require("../services/orderStatus.service");
const { square } = require("../lib/square");
const { SquareError } = require("square");
const { env } = require("../lib/env");
const { markPaymentSucceeded, markPaymentFailed } = require("../services/payments.service");
const { nextSequenceValue } = require("../lib/sequentialNumber");
const { escapeLikeWildcards } = require("../lib/searchText");

const router = express.Router();

// Shared with pos.service.js and posReturns.service.js's own nextOrderNumber
// — every Order, regardless of channel, draws from this one "order" counter
// so numbers never collide across ONLINE/POS/exchange orders.
async function nextOrderNumber(db) {
  const count = await nextSequenceValue("order", db);
  return `BE-${100000 + count}`;
}

function serializeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillmentMethod: order.fulfillmentMethod,
    // Staff-facing unified status (see apps/api/src/services/orderStatus.service.js)
    // — a computed label, never stored, derived fresh from the three real
    // fields above on every serialization.
    displayStatus: computeOrderDisplayStatus(order),
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    customer: order.customer
      ? { id: order.customer.id, email: order.customer.email, firstName: order.customer.firstName, lastName: order.customer.lastName }
      : null,
    lines: order.lines?.map((l) => ({
      id: l.id,
      sku: l.skuSnapshot,
      name: l.nameSnapshot,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      taxCents: l.taxCents,
      lineTotalCents: l.lineTotalCents,
    })),
    createdAt: order.createdAt,
  };
}

// --- Public checkout (storefront) -----------------------------------------
//
// Two-step flow, because Square's CreatePayment needs a card token the
// client can only produce *after* it knows the final amount (the Web
// Payments SDK tokenizes in the browser, then this backend charges that
// token) — the Web Payments SDK tokenizes in the browser once the final
// amount is known, then this backend charges that token:
//   1. POST /checkout        — build the priced, inventory-reserved order and
//      a PENDING Payment placeholder row. No money moves yet.
//   2. POST /checkout/:id/pay — the storefront submits the card token
//      (sourceId) it just tokenized via the Web Payments SDK; this route
//      calls Square's CreatePayment and marks the order Paid only once
//      Square's response itself says COMPLETED (see handler below) — never
//      inferred from a client-side "it looked fine" callback alone, per the
//      kickoff plan's "never assume terminal pending means paid" rule.
// The Square webhook (src/routes/webhooks.routes.js) is a second,
// independently-idempotent confirmation path for the same event, in case
// the synchronous CreatePayment call above times out before this process
// sees its own response.
router.post(
  "/checkout",
  validateBody(checkoutCreateSchema),
  asyncHandler(async (req, res) => {
    const { lines, fulfillmentMethod, customer: customerInput, deliveryAddress } = req.body;

    await inventoryService.expireStaleReservations();

    const warehouse = await prisma.location.findFirst({ where: { type: "WAREHOUSE", isActive: true } });
    if (!warehouse) throw new ConflictError("No active fulfillment location configured");

    const variantIds = lines.map((l) => l.variantId);
    const variants = await prisma.variant.findMany({ where: { id: { in: variantIds } }, include: { product: true } });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    for (const line of lines) {
      const variant = variantById.get(line.variantId);
      if (!variant || !variant.isActive) {
        throw new ConflictError(`Product variant ${line.variantId} is not available`);
      }
    }

    // Scoped to channel: "ONLINE" so this can only ever find/update an
    // online-origin Customer row — a cashier having used this same email in
    // POS must never cause a checkout here to land on, or merge into, that
    // separate POS-channel record (see Customer.channel in schema.prisma).
    const customer = await prisma.customer.upsert({
      where: { email_channel: { email: customerInput.email, channel: "ONLINE" } },
      update: { firstName: customerInput.firstName, lastName: customerInput.lastName, phone: customerInput.phone },
      create: { ...customerInput, channel: "ONLINE" },
    });

    const subtotalCents = lines.reduce((sum, l) => sum + variantById.get(l.variantId).priceCents * l.quantity, 0);

    // Tax is charged per line at that variant's own flat rate (captured by
    // staff on the product as e.g. 8.25%) rather than one rate for the whole
    // order, since different variants are allowed different taxRatePercent
    // values. Rounded per line, then summed, rather than rounding once on
    // the order total — matches how a receipt itemizes tax per line. Indexed
    // by position (not variantId) since the same variant can appear as two
    // separate cart lines.
    const lineTaxCentsByIndex = lines.map((l) => {
      const variant = variantById.get(l.variantId);
      const lineSubtotalCents = variant.priceCents * l.quantity;
      return Math.round((lineSubtotalCents * Number(variant.taxRatePercent)) / 100);
    });
    const taxCents = lineTaxCentsByIndex.reduce((sum, t) => sum + t, 0);

    const deliveryAddressRecord = await saveCheckoutDeliveryAddress(customer.id, deliveryAddress);

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await nextOrderNumber(tx);
      return tx.order.create({
        data: {
          orderNumber,
          channel: "ONLINE",
          customerId: customer.id,
          status: "DRAFT",
          paymentStatus: "UNPAID",
          fulfillmentStatus: "UNALLOCATED",
          fulfillmentMethod,
          subtotalCents,
          taxCents,
          totalCents: subtotalCents + taxCents,
          ...(deliveryAddressRecord ? { deliveryAddressId: deliveryAddressRecord.id } : {}),
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
          ...(deliveryAddressRecord
            ? {
                deliveries: {
                  create: { feeCents: 0, addressId: deliveryAddressRecord.id },
                },
              }
            : {}),
        },
        include: { lines: true, customer: true },
      });
    });

    const reservationFailures = [];
    for (const line of lines) {
      try {
        await inventoryService.reserveStock({
          variantId: line.variantId,
          locationId: warehouse.id,
          quantity: line.quantity,
          orderId: order.id,
        });
      } catch {
        reservationFailures.push(line.variantId);
      }
    }

    if (reservationFailures.length > 0) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELED" } });
      throw new ConflictError("One or more items went out of stock during checkout", {
        unavailableVariantIds: reservationFailures,
      });
    }

    const confirmed = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED", fulfillmentStatus: "RESERVED" },
      include: { lines: true, customer: true },
    });

    // No money moves here — this Payment row just reserves the slot the
    // storefront will charge against in POST /checkout/:id/pay once it has
    // tokenized a card. Its own id doubles as the Square idempotency key for
    // that charge (see the /pay handler below): stable across a client
    // retrying the same attempt, but a genuinely new attempt (new Payment
    // row) would get its own key.
    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          orderId: confirmed.id,
          method: "CARD",
          status: "PENDING",
          amountCents: confirmed.totalCents,
          providerName: "square",
        },
      });
    } catch (err) {
      // If even recording the placeholder fails, the order must not be left
      // CONFIRMED/RESERVED with stock held hostage and no way to pay —
      // release every reservation just created and cancel the order, same
      // as the out-of-stock rollback above.
      const activeReservations = await prisma.reservation.findMany({
        where: { orderId: confirmed.id, status: "ACTIVE" },
      });
      for (const reservation of activeReservations) {
        await inventoryService.releaseReservation(reservation.id);
      }
      await prisma.order.update({ where: { id: confirmed.id }, data: { status: "CANCELED" } });
      throw err;
    }

    res.status(201).json({
      order: serializeOrder(confirmed),
      paymentId: payment.id,
      amountCents: confirmed.totalCents,
    });
  })
);

// Square error codes (see https://developer.squareup.com/reference/square/objects/ErrorCode)
// that mean "the card was declined" in some form, as opposed to a request
// shape problem or a transient Square-side failure — used only to decide the
// customer-facing message, not to change what gets persisted (every
// non-COMPLETED outcome is handled identically: Payment -> FAILED, order's
// reservations released, Order -> CANCELED).
const DECLINE_ERROR_CODES = new Set([
  "CARD_DECLINED",
  "CARD_DECLINED_CALL_ISSUER",
  "CARD_DECLINED_VERIFICATION_REQUIRED",
  "CVV_FAILURE",
  "ADDRESS_VERIFICATION_FAILURE",
  "INSUFFICIENT_FUNDS",
  "INVALID_EXPIRATION",
  "CARD_EXPIRED",
  "TRANSACTION_LIMIT",
]);

// The storefront calls this once per payment attempt, right after
// card.tokenize() resolves. Looks the pending Payment back up by id (never
// trusts a client-supplied amount/orderId pair) so the charge is always for
// exactly what checkout already priced and reserved stock for.
router.post(
  "/checkout/:id/pay",
  validateBody(checkoutPaySchema),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { lines: true, customer: true, payments: { orderBy: { createdAt: "desc" } } },
    });
    if (!order) throw new NotFoundError("Order not found");

    const payment = order.payments[0];
    if (!payment || payment.status !== "PENDING") {
      // Either this order never got a pending Payment row (shouldn't happen
      // — created in POST /checkout), or it's already been paid/failed —
      // either way there's nothing left here for this endpoint to do safely.
      throw new ConflictError("This order has no payment awaiting charge");
    }

    let result;
    try {
      // idempotencyKey = payment.id: a client double-click or network-retry
      // resubmitting the same sourceId reuses this same key, so Square
      // returns the original payment instead of creating a second charge
      // (see docs/requirements/open-questions.md's three required tests).
      result = await square.payments.create({
        idempotencyKey: payment.id,
        sourceId: req.body.sourceId,
        // Carries the result of the storefront's verifyBuyer() 3D Secure/SCA
        // challenge (apps/storefront/app/checkout/page.jsx's PaymentForm) —
        // without it, CreatePayment has no proof buyer verification ran, and
        // a card issuer that requires it will simply decline the charge.
        verificationToken: req.body.verificationToken,
        amountMoney: { amount: BigInt(payment.amountCents), currency: "USD" },
        locationId: env.squareLocationId,
        referenceId: order.id,
        note: `Order ${order.orderNumber}`,
      });
    } catch (err) {
      if (err instanceof SquareError) {
        const declineError = err.errors?.find((e) => DECLINE_ERROR_CODES.has(e.code));
        await markPaymentFailed(payment.id, order.id, declineError?.detail || err.message || "Payment failed");
        throw new ApiError(402, declineError?.detail || "Your card was declined. Please try a different card.", {
          code: declineError?.code,
        });
      }
      throw err;
    }

    const squarePayment = result.payment;
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: squarePayment.id },
    });

    if (squarePayment.status === "COMPLETED") {
      await markPaymentSucceeded(payment.id, order.id);
      const paid = await prisma.order.findUnique({ where: { id: order.id }, include: { lines: true, customer: true } });
      return res.json({ order: serializeOrder(paid), paymentStatus: "COMPLETED" });
    }

    // APPROVED (delayed capture) and PENDING both mean "not yet a final
    // decline, but not confirmed paid either" — left PENDING here rather
    // than guessed at; the webhook will resolve it to COMPLETED or FAILED
    // once Square finishes. FAILED/CANCELED from a 200 response (rather than
    // a thrown SquareError) are treated the same as a thrown decline.
    if (squarePayment.status === "FAILED" || squarePayment.status === "CANCELED") {
      await markPaymentFailed(payment.id, order.id, "Payment failed");
      throw new ApiError(402, "Your card was declined. Please try a different card.");
    }

    res.json({ order: serializeOrder(order), paymentStatus: squarePayment.status });
  })
);

router.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { lines: true, customer: true },
    });
    if (!order) throw new NotFoundError("Order not found");
    res.json({ order: serializeOrder(order) });
  })
);

// --- Staff (admin) -------------------------------------------------------

// Paginated + server-searched — a hard take:200 with no skip/q used to mean
// orders beyond the newest 200 were permanently unreachable and
// unsearchable from this page once the store had more order history than
// that. `q` matches order number, customer email, or customer name (same
// multi-term-AND approach as customers.service.js's buildWhere, so "jane
// doe" finds a customer whose first/last name are in different columns).
const ORDERS_MAX_PAGE_SIZE = 100;
const ORDERS_DEFAULT_PAGE_SIZE = 25;
const ORDERS_MAX_SEARCH_TERMS = 5;

function buildOrdersSearchWhere(q) {
  const terms = String(q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, ORDERS_MAX_SEARCH_TERMS);
  if (terms.length === 0) return {};

  return {
    AND: terms.map((term) => {
      const contains = { contains: escapeLikeWildcards(term), mode: "insensitive" };
      return {
        OR: [
          { orderNumber: contains },
          { customer: { email: contains } },
          { customer: { firstName: contains } },
          { customer: { lastName: contains } },
        ],
      };
    }),
  };
}

router.get(
  "/admin/orders",
  requireAuth,
  requirePermission("orders:read"),
  asyncHandler(async (req, res) => {
    const { displayStatus, paymentStatus, channel, q, page, pageSize } = req.query;
    const take = Math.min(ORDERS_MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(pageSize)) || ORDERS_DEFAULT_PAGE_SIZE));
    const currentPage = Math.max(1, Math.floor(Number(page)) || 1);
    // A Salesman only sees orders they're attributed to; Manager/Admin/Super
    // Admin see everything. Checked as "holds SALESMAN but none of the
    // broader roles" so a user with both SALESMAN and MANAGER (multi-role
    // accounts are allowed — see users.routes.js) still gets the unrestricted
    // Manager view rather than being narrowed.
    const isSalesmanOnly =
      req.user.roles.includes("SALESMAN") &&
      !req.user.roles.some((role) => ["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role));
    // Combined via AND (not a flat spread) since orderWhereForDisplayStatus
    // can itself contain channel/OR clauses (e.g. "Processing" scopes to
    // ONLINE) that a flat spread would silently clobber or be clobbered by.
    const conditions = [
      ...(displayStatus ? [orderWhereForDisplayStatus(String(displayStatus))] : []),
      // Admin-facing filter is deliberately just Paid/Unpaid (not every
      // PaymentStatus enum value) — PARTIALLY_PAID/REFUNDED orders still
      // show up under Unpaid here, matching the plain two-state choice this
      // filter offers rather than exposing the full raw enum.
      ...(paymentStatus === "PAID" ? [{ paymentStatus: "PAID" }] : []),
      ...(paymentStatus === "UNPAID" ? [{ paymentStatus: { not: "PAID" } }] : []),
      ...(channel ? [{ channel: String(channel) }] : []),
      ...(isSalesmanOnly ? [{ salesAttributions: { some: { userId: req.user.id } } }] : []),
      buildOrdersSearchWhere(q),
    ];
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { lines: true, customer: true },
        // id breaks ties so paging stays stable when orders share a timestamp.
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (currentPage - 1) * take,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders: orders.map(serializeOrder),
      pagination: { page: currentPage, pageSize: take, total },
    });
  })
);

// Richest order shape in the admin app — every relation a staff member would
// need to answer "what happened on this order" without jumping between
// screens: priced lines (with product image), the full payment/refund
// ledger, fulfillment records, and the append-only status timeline.
// deliveryAddressId and Delivery.addressId are both loose string columns,
// not Prisma relations (see schema.prisma), so the Address rows they point
// at are fetched separately and matched up in serialization.
const ADMIN_ORDER_DETAIL_INCLUDE = {
  lines: {
    include: {
      variant: {
        include: {
          product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
        },
      },
    },
  },
  payments: {
    include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  },
  refunds: { orderBy: { createdAt: "asc" } },
  customer: { include: { addresses: true } },
  receipts: { orderBy: { createdAt: "asc" } },
  deliveries: { orderBy: { createdAt: "asc" } },
  pickups: { orderBy: { createdAt: "asc" } },
  statusHistory: { orderBy: { createdAt: "asc" } },
  shippingAddress: true,
  billingAddress: true,
  discountApprovedBy: { select: { id: true, firstName: true, lastName: true } },
  salesAttributions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
};

function serializeAdminOrderDetail(order, addressById) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillmentMethod: order.fulfillmentMethod,
    displayStatus: computeOrderDisplayStatus(order),
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    deliveryFeeCents: order.deliveryFeeCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    deliveryNotes: order.deliveryNotes,
    assemblyNotes: order.assemblyNotes,
    scheduledDate: order.scheduledDate,
    deliveryAddress: addressById.get(order.deliveryAddressId) ?? null,
    discountPercent: order.discountPercent,
    discountApprovedBy: order.discountApprovedBy
      ? { id: order.discountApprovedBy.id, firstName: order.discountApprovedBy.firstName, lastName: order.discountApprovedBy.lastName }
      : null,
    requestedDeliveryAt: order.requestedDeliveryAt,
    shippingAddress: order.shippingAddress ?? null,
    billingAddress: order.billingAddress ?? null,
    salesAttributions: order.salesAttributions.map((a) => ({
      userId: a.userId,
      userName: `${a.user.firstName} ${a.user.lastName}`,
      role: a.role,
      splitPercent: a.splitPercent,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: order.customer
      ? {
          id: order.customer.id,
          email: order.customer.email,
          phone: order.customer.phone,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          addresses: order.customer.addresses,
        }
      : null,
    lines: order.lines.map((l) => ({
      id: l.id,
      sku: l.skuSnapshot,
      name: l.nameSnapshot,
      imageUrl: l.variant?.product?.images?.[0]?.url ?? null,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      taxCents: l.taxCents,
      discountCents: l.discountCents,
      lineTotalCents: l.lineTotalCents,
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amountCents: p.amountCents,
      reference: p.reference,
      providerName: p.providerName,
      providerRef: p.providerRef,
      failureReason: p.failureReason,
      performedBy: p.performedBy ? { id: p.performedBy.id, firstName: p.performedBy.firstName, lastName: p.performedBy.lastName } : null,
      createdAt: p.createdAt,
    })),
    refunds: order.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      reasonCode: r.reasonCode,
      notes: r.notes,
      paymentId: r.paymentId,
      createdAt: r.createdAt,
    })),
    receipts: order.receipts.map((r) => ({ id: r.id, receiptNumber: r.receiptNumber, createdAt: r.createdAt })),
    deliveries: order.deliveries.map((d) => ({
      id: d.id,
      feeCents: d.feeCents,
      scheduledDate: d.scheduledDate,
      deliveredAt: d.deliveredAt,
      notes: d.notes,
      address: addressById.get(d.addressId) ?? null,
      createdAt: d.createdAt,
    })),
    pickups: order.pickups.map((p) => ({
      id: p.id,
      scheduledDate: p.scheduledDate,
      pickedUpAt: p.pickedUpAt,
      notes: p.notes,
      createdAt: p.createdAt,
    })),
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      field: h.field,
      fromValue: h.fromValue,
      toValue: h.toValue,
      note: h.note,
      createdAt: h.createdAt,
    })),
  };
}

router.get(
  "/admin/orders/:id",
  requireAuth,
  requirePermission("orders:read"),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: ADMIN_ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundError("Order not found");

    const addressIds = [order.deliveryAddressId, ...order.deliveries.map((d) => d.addressId)].filter(Boolean);
    const addresses = addressIds.length
      ? await prisma.address.findMany({ where: { id: { in: addressIds } } })
      : [];
    const addressById = new Map(addresses.map((a) => [a.id, a]));

    res.json({ order: serializeAdminOrderDetail(order, addressById) });
  })
);

// Staff-initiated change to the unified display status (see
// orderStatus.service.js) — the one deliberate writer of StatusHistory rows
// today. "Draft" and "Canceled" are display-only and rejected by the Zod
// schema itself (orderDisplayStatusSchema has no such members), so this
// handler only ever has to reject an otherwise-legal label that doesn't fit
// *this* order's channel (e.g. "Processing" on a POS order) or an order
// that's already canceled. No stock/inventory involvement: by the time an
// order reaches any fulfillmentStatus this endpoint can set, the sale's
// stock conversion already happened earlier (checkout-confirm's reserve, or
// POS ringSale's reserve+convert) — this is a pure status/audit write, so
// the transaction below is just for atomicity between the two writes, not
// for stock locking.
router.patch(
  "/admin/orders/:id/status",
  requireAuth,
  requirePermission("orders:write"),
  validateBody(orderStatusUpdateSchema),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new NotFoundError("Order not found");

    if (order.status === "CANCELED") {
      throw new ConflictError("This order is canceled and its status can no longer be changed");
    }

    const legalTargets = legalTargetStatusesForChannel(order.channel);
    if (!legalTargets.includes(req.body.displayStatus)) {
      throw new ConflictError(`"${req.body.displayStatus}" is not a valid status for a ${order.channel} order`, {
        legalTargets,
      });
    }

    const fromDisplayStatus = computeOrderDisplayStatus(order);
    const fieldWrites = resolveOrderStatusFieldWrites(order, req.body.displayStatus);
    // Stamp once, only on the transition into Completed, and only if it was
    // never set before — re-saving "Completed" (or any later status change)
    // must never move this date forward, since it backs the storefront's
    // 7-day Return window.
    if (req.body.displayStatus === "Completed" && !order.completedAt) {
      fieldWrites.completedAt = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({ where: { id: order.id }, data: fieldWrites });
      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          field: "displayStatus",
          fromValue: fromDisplayStatus,
          toValue: req.body.displayStatus,
          note: req.body.note ?? null,
        },
      });
      return updatedOrder;
    });

    // Deliberately a narrow, explicit shape — NOT serializeOrder(updated) —
    // since `updated` is a bare Order row with no `lines`/`customer`
    // include. A caller that naively spread a serializeOrder-shaped
    // response onto its existing row data (e.g. the admin list page
    // patching one row in place) would otherwise clobber those already-
    // loaded relations with null/undefined. Only the fields that actually
    // changed are returned; the admin detail page separately re-fetches the
    // full record after a successful change to refresh its Status History
    // table.
    res.json({
      order: {
        id: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        fulfillmentStatus: updated.fulfillmentStatus,
        displayStatus: computeOrderDisplayStatus(updated),
      },
    });
  })
);

module.exports = router;
