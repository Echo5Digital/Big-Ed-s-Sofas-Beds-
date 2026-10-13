const express = require("express");
const { prisma } = require("@big-eds/database");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/overview",
  requirePermission("reports:read"),
  asyncHandler(async (req, res) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [ordersToday, salesTodayAgg, lowStockBalances, inboundLines] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfToday }, status: { not: "CANCELED" } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfToday }, status: { not: "CANCELED" } },
        _sum: { totalCents: true },
      }),
      prisma.stockBalance.findMany({
        include: { variant: { include: { product: true } }, location: true },
      }),
      prisma.pOLine.findMany({
        where: { purchaseOrder: { status: { in: ["SENT_TO_VENDOR", "PARTIALLY_RECEIVED"] } } },
        include: { variant: true, purchaseOrder: true },
      }),
    ]);

    const lowStock = lowStockBalances
      .map((b) => ({
        sku: b.variant.sku,
        productName: b.variant.product.name,
        variantName: b.variant.name,
        locationName: b.location.name,
        availableToSell: Math.max(0, b.onHand - b.reserved - b.quarantined),
        reserved: b.reserved,
      }))
      .filter((b) => b.availableToSell <= 2)
      .slice(0, 10);

    const inbound = inboundLines
      .filter((l) => l.receivedQty < l.expectedQty)
      .map((l) => ({
        sku: l.skuSnapshot,
        poNumber: l.purchaseOrder.poNumber,
        remainingQty: l.expectedQty - l.receivedQty,
      }))
      .slice(0, 10);

    res.json({
      salesTodayCents: salesTodayAgg._sum.totalCents ?? 0,
      ordersToday,
      lowStockCount: lowStock.length,
      lowStock,
      inbound,
    });
  })
);

module.exports = router;
