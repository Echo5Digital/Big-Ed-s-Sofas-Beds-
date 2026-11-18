const express = require("express");
const { prisma } = require("@big-eds/database");
const { checkoutCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const inventoryService = require("../services/inventory.service");
const { saveCheckoutDeliveryAddress } = require("../services/orders.service");
const { stripe } = require("../lib/stripe");
const { nextSequenceValue } = require("../lib/sequentialNumber");

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
// Builds a priced, inventory-reserved order and creates a Stripe PaymentIntent
// for it. The order stays UNPAID (and the reservation stays ACTIVE, not yet
// converted to a sale) until the Stripe webhook confirms payment — a
// client-side "payment succeeded" callback is never trusted on its own, per
// the kickoff plan's "never assume terminal pending means paid" rule. See
// src/routes/webhooks.routes.js for the confirmation path.
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

    // If PaymentIntent creation (or recording it) fails, the order must not
    // be left CONFIRMED/RESERVED with stock held hostage and no way to pay —
    // release every reservation just created and cancel the order, same as
    // the out-of-stock rollback above.
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: confirmed.totalCents,
        currency: "usd",
        metadata: { orderId: confirmed.id, orderNumber: confirmed.orderNumber },
      });

      await prisma.payment.create({
        data: {
          orderId: confirmed.id,
          method: "CARD",
          status: "PENDING",
          amountCents: confirmed.totalCents,
          providerName: "stripe",
          providerRef: paymentIntent.id,
        },
      });
    } catch (err) {
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
      clientSecret: paymentIntent.client_secret,
    });
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

router.get(
  "/admin/orders",
  requireAuth,
  requirePermission("orders:read"),
  asyncHandler(async (req, res) => {
    const { status, fulfillmentStatus, channel } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(fulfillmentStatus ? { fulfillmentStatus: String(fulfillmentStatus) } : {}),
        ...(channel ? { channel: String(channel) } : {}),
      },
      include: { lines: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ orders: orders.map(serializeOrder) });
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

module.exports = router;
