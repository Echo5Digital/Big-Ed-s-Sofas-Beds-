const express = require("express");
const { prisma } = require("@big-eds/database");
const { checkoutCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const inventoryService = require("../services/inventory.service");

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
// Scope note: this endpoint builds a priced, inventory-reserved DRAFT order.
// It deliberately stops short of charging a card — per the kickoff plan,
// payment/provider integration requires a confirmed provider + reviewed spec
// before going live. The order is left UNPAID with an active reservation
// until that integration exists; nothing here marks a sale "complete."
router.post(
  "/checkout",
  validateBody(checkoutCreateSchema),
  asyncHandler(async (req, res) => {
    const { lines, fulfillmentMethod, customer: customerInput, deliveryAddress } = req.body;

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

    const orderNumber = await nextOrderNumber();

    const subtotalCents = lines.reduce((sum, l) => sum + variantById.get(l.variantId).priceCents * l.quantity, 0);

    const order = await prisma.order.create({
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
        ...(deliveryAddress
          ? {
              deliveries: {
                create: { feeCents: 0 },
              },
            }
          : {}),
      },
      include: { lines: true, customer: true },
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

    res.status(201).json({
      order: serializeOrder(confirmed),
      paymentNote: "Payment processing is not yet integrated. This order is reserved and unpaid pending provider setup.",
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

module.exports = router;
