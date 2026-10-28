const express = require("express");
const { prisma } = require("@big-eds/database");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission("reports:read"));

function parseDayRange(dateParam) {
  const start = dateParam ? new Date(dateParam) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Date-scoped version of /dashboard/overview's stat tiles, so the Reports
// page can show any selected day rather than always "today". Low stock is
// a current snapshot (not a historical concept) so it ignores the date.
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const { start, end } = parseDayRange(req.query.date);

    const [ordersInRange, salesAgg, lowStockBalances] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" } },
        _sum: { totalCents: true },
      }),
      prisma.stockBalance.findMany({
        include: { variant: { include: { product: true } }, location: true },
      }),
    ]);

    const lowStockCount = lowStockBalances
      .map((b) => Math.max(0, b.onHand - b.reserved - b.quarantined))
      .filter((available) => available <= 2).length;

    res.json({
      date: start.toISOString(),
      salesCents: salesAgg._sum.totalCents ?? 0,
      orders: ordersInRange,
      lowStockCount,
    });
  })
);

// Full register session history (open and closed), newest first, each with
// its cash movements broken down by type and the receipts/orders sold during
// that session. Backs the Reports page's register open/close + sales log —
// read-only, nothing here mutates a session or its movements.
router.get(
  "/register-sessions",
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.from || req.query.to) {
      where.openedAt = {};
      if (req.query.from) where.openedAt.gte = new Date(req.query.from);
      if (req.query.to) where.openedAt.lt = new Date(req.query.to);
    }

    const sessions = await prisma.registerSession.findMany({
      where,
      include: {
        register: { include: { location: true } },
        openedBy: true,
        cashMovements: { orderBy: { createdAt: "asc" } },
        receipts: {
          include: {
            order: { include: { lines: true, payments: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { openedAt: "desc" },
      take: 200,
    });

    res.json({
      sessions: sessions.map((session) => {
        const movementTotals = session.cashMovements.reduce((totals, m) => {
          totals[m.type] = (totals[m.type] || 0) + m.amountCents;
          return totals;
        }, {});

        return {
          id: session.id,
          registerName: session.register?.name ?? "—",
          locationName: session.register?.location?.name ?? "—",
          status: session.status,
          openedByName: session.openedBy
            ? `${session.openedBy.firstName} ${session.openedBy.lastName}`
            : "—",
          openingCashCents: session.openingCashCents,
          closingCashCents: session.closingCashCents,
          expectedCashCents: session.expectedCashCents,
          discrepancyCents: session.discrepancyCents,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          movementTotals,
          cashMovements: session.cashMovements.map((m) => ({
            id: m.id,
            type: m.type,
            amountCents: m.amountCents,
            notes: m.notes,
            createdAt: m.createdAt,
          })),
          sales: session.receipts
            .filter((r) => r.order)
            .map((r) => ({
              id: r.id,
              receiptNumber: r.receiptNumber,
              orderNumber: r.order.orderNumber,
              totalCents: r.order.totalCents,
              tenderMethod: r.order.payments?.[0]?.method ?? null,
              itemCount: r.order.lines.reduce((sum, l) => sum + l.quantity, 0),
              createdAt: r.createdAt,
            })),
        };
      }),
    });
  })
);

module.exports = router;
