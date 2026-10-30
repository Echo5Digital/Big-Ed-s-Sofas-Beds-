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

    // Computed in SQL rather than fetching every (variant, location) row and
    // filtering in JS — see /dashboard/overview for the same fix with more
    // detail on why that mattered at scale.
    const [ordersInRange, salesAgg, lowStockCountRow] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" } },
        _sum: { totalCents: true },
      }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM "StockBalance" sb
        WHERE GREATEST(sb."onHand" - sb.reserved - sb.quarantined, 0) <= 2
      `,
    ]);

    const lowStockCount = lowStockCountRow[0]?.count ?? 0;

    res.json({
      date: start.toISOString(),
      salesCents: salesAgg._sum.totalCents ?? 0,
      orders: ordersInRange,
      lowStockCount,
    });
  })
);

// Daily revenue + order count for the last `days` calendar days (including
// today), oldest first — backs the admin dashboard's trend chart. Buckets by
// the database's own local day boundary (date_trunc) rather than JS Date
// math so the grouping is a single indexed query instead of N separate
// day-range queries. Days with no orders still appear in the response with
// zero values, filled in client-side isn't needed since we left-join against
// a generated date series here.
router.get(
  "/sales-trend",
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));

    const rows = await prisma.$queryRaw`
      SELECT
        day_series.day AS day,
        COALESCE(SUM(o."totalCents"), 0)::bigint AS "salesCents",
        COUNT(o.id)::int AS orders
      FROM generate_series(
        date_trunc('day', now()) - (${days - 1} || ' days')::interval,
        date_trunc('day', now()),
        '1 day'::interval
      ) AS day_series(day)
      LEFT JOIN "Order" o
        ON date_trunc('day', o."createdAt") = day_series.day
        AND o.status != 'CANCELED'
      GROUP BY day_series.day
      ORDER BY day_series.day ASC
    `;

    res.json({
      days: rows.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        salesCents: Number(r.salesCents),
        orders: r.orders,
      })),
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
