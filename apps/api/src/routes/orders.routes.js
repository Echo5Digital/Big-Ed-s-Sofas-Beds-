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
const { createWithSequentialNumber } = require("../lib/sequentialNumber");

const router = express.Router();

async function nextOrderNumber() {
  const count = await prisma.order.count();
  return `BE-${100000 + count + 1}`;
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

    const customer = await prisma.customer.upsert({
      where: { email: customerInput.email },
      update: { firstName: customerInput.firstName, lastName: customerInput.lastName, phone: customerInput.phone },
      create: customerInput,
    });

    const subtotalCents = lines.reduce((sum, l) => sum + variantById.get(l.variantId).priceCents * l.quantity, 0);

    const deliveryAddressRecord = await saveCheckoutDeliveryAddress(customer.id, deliveryAddress);

    const order = await createWithSequentialNumber(async () => {
      const orderNumber = await nextOrderNumber();
      return prisma.order.create({
        data: {
          orderNumber,
          channel: "ONLINE",
          customerId: customer.id,
          status: "DRAFT",
          paymentStatus: "UNPAID",
          fulfillmentStatus: "UNALLOCATED",
          fulfillmentMethod,
          subtotalCents,
          totalCents: subtotalCents,
          ...(deliveryAddressRecord ? { deliveryAddressId: deliveryAddressRecord.id } : {}),
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
    const { status, fulfillmentStatus } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(fulfillmentStatus ? { fulfillmentStatus: String(fulfillmentStatus) } : {}),
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
