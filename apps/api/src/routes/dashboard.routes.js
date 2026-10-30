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

    // Low stock is computed in SQL (availableToSell = onHand - reserved -
    // quarantined, filtered to <= 2) instead of fetching every (variant,
    // location) row in the store and filtering in JS — at scale that was
    // transferring the entire StockBalance table (plus two joined tables)
    // over the network just to keep ~10 rows. lowStockRows gives the top-10
    // detail list (scarcest first); lowStockCountRow gives the true total
    // so the stat tile isn't silently capped at 10 like the list is.
    const LOW_STOCK_THRESHOLD = 2;
    const [
      ordersToday,
      salesTodayAgg,
      lowStockRows,
      lowStockCountRow,
      inboundLines,
      ordersByStatus,
      poByStatus,
      activeProductCount,
      categoryCount,
      registerSessionsToday,
      recentOrders,
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfToday }, status: { not: "CANCELED" } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfToday }, status: { not: "CANCELED" } },
        _sum: { totalCents: true },
      }),
      prisma.$queryRaw`
        SELECT
          v.sku AS sku,
          p.name AS "productName",
          v.name AS "variantName",
          l.name AS "locationName",
          GREATEST(sb."onHand" - sb.reserved - sb.quarantined, 0) AS "availableToSell",
          sb.reserved AS reserved
        FROM "StockBalance" sb
        JOIN "Variant" v ON v.id = sb."variantId"
        JOIN "Product" p ON p.id = v."productId"
        JOIN "Location" l ON l.id = sb."locationId"
        WHERE GREATEST(sb."onHand" - sb.reserved - sb.quarantined, 0) <= ${LOW_STOCK_THRESHOLD}
        ORDER BY "availableToSell" ASC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM "StockBalance" sb
        WHERE GREATEST(sb."onHand" - sb.reserved - sb.quarantined, 0) <= ${LOW_STOCK_THRESHOLD}
      `,
      prisma.pOLine.findMany({
        where: { purchaseOrder: { status: { in: ["SENT_TO_VENDOR", "PARTIALLY_RECEIVED"] } } },
        include: { variant: true, purchaseOrder: true },
      }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.purchaseOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.category.count(),
      prisma.registerSession.findMany({
        where: { openedAt: { gte: startOfToday } },
        include: { cashMovements: true },
      }),
      prisma.order.findMany({
        where: { status: { not: "CANCELED" } },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const lowStock = lowStockRows.map((b) => ({
      sku: b.sku,
      productName: b.productName,
      variantName: b.variantName,
      locationName: b.locationName,
      availableToSell: b.availableToSell,
      reserved: b.reserved,
    }));
    const lowStockCount = lowStockCountRow[0]?.count ?? 0;

    const inbound = inboundLines
      .filter((l) => l.receivedQty < l.expectedQty)
      .map((l) => ({
        sku: l.skuSnapshot,
        poNumber: l.purchaseOrder.poNumber,
        remainingQty: l.expectedQty - l.receivedQty,
      }))
      .slice(0, 10);

    const cashSalesTodayCents = registerSessionsToday.reduce((sum, session) => {
      const sessionCash = session.cashMovements
        .filter((m) => m.type === "SALE" || m.type === "DEPOSIT")
        .reduce((s, m) => s + m.amountCents, 0);
      return sum + sessionCash;
    }, 0);

    res.json({
      salesTodayCents: salesTodayAgg._sum.totalCents ?? 0,
      ordersToday,
      lowStockCount,
      lowStock,
      inbound,
      ordersByStatus: ordersByStatus.map((g) => ({ status: g.status, count: g._count._all })),
      purchaseOrdersByStatus: poByStatus.map((g) => ({ status: g.status, count: g._count._all })),
      catalog: { activeProducts: activeProductCount, categories: categoryCount },
      registerActivityToday: {
        openCount: registerSessionsToday.filter((s) => s.status === "OPEN").length,
        closedCount: registerSessionsToday.filter((s) => s.status === "CLOSED").length,
        pendingApprovalCount: registerSessionsToday.filter((s) => s.status === "PENDING_REOPEN_APPROVAL").length,
        cashSalesTodayCents,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        channel: o.channel,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalCents: o.totalCents,
        customerName: o.customer ? `${o.customer.firstName ?? ""} ${o.customer.lastName ?? ""}`.trim() : "Guest",
        createdAt: o.createdAt,
      })),
    });
  })
);

module.exports = router;
