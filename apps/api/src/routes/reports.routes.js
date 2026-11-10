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

// `monthParam` is a "YYYY-MM" string (the shape of an <input type="month">).
// Falls back to the current calendar month on anything unparseable, same
// fallback behavior as parseDayRange above.
function parseMonthRange(monthParam) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(year, monthIndex, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

// PurchaseOrder has no stored spend total — every line's committed cost is
// expectedQty * unitCostCents, plus its own tax/freight, matching the same
// formula purchasing.routes.js's PO export endpoint already uses so this
// number can't silently diverge from what a PO's own line items show.
function lineSpendCents(line) {
  return line.expectedQty * line.unitCostCents + line.taxCents + line.freightCents;
}

// Date-scoped version of /dashboard/overview's stat tiles, so the Reports
// page can show any selected day (or, with ?month=YYYY-MM, a whole calendar
// month) rather than always "today". Low stock is a current snapshot (not a
// historical concept) so it ignores the date/month range. Payment-method
// breakdowns, deposits, refunds, and outstanding balances live on the
// Payments page (/api/payments/stats) — this endpoint intentionally stays
// focused on order/purchasing/catalog activity so the two pages don't show
// overlapping, potentially-diverging numbers for the same concept.
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const { start, end } = req.query.month ? parseMonthRange(req.query.month) : parseDayRange(req.query.date);

    // Computed in SQL rather than fetching every (variant, location) row and
    // filtering in JS — see /dashboard/overview for the same fix with more
    // detail on why that mattered at scale.
    const [
      ordersInRange,
      salesAgg,
      lowStockCountRow,
      newCustomers,
      poByStatus,
      poLinesInRange,
    ] = await Promise.all([
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
      prisma.customer.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.purchaseOrder.groupBy({
        by: ["status"],
        where: { createdAt: { gte: start, lt: end } },
        _count: { _all: true },
      }),
      prisma.pOLine.findMany({
        where: { purchaseOrder: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" } } },
        select: { expectedQty: true, unitCostCents: true, taxCents: true, freightCents: true },
      }),
    ]);

    const lowStockCount = lowStockCountRow[0]?.count ?? 0;
    const purchasingSpendCents = poLinesInRange.reduce((sum, line) => sum + lineSpendCents(line), 0);

    res.json({
      date: start.toISOString(),
      rangeEnd: end.toISOString(),
      salesCents: salesAgg._sum.totalCents ?? 0,
      orders: ordersInRange,
      lowStockCount,
      newCustomers,
      purchaseOrdersByStatus: poByStatus.map((g) => ({ status: g.status, count: g._count._all })),
      purchasingSpendCents,
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

// Profit/margin report: revenue, cost, and margin $/% for a date range,
// broken down by product and summarized store-wide. Gated by
// "catalog:cost:view" IN ADDITION TO "reports:read" (already required for
// this whole router above) — this is the one report that reveals supplier
// cost, so it needs the same permission as every other cost-visibility
// surface (admin product form, POS checkout), not just general report access.
//
// Cost is read from OrderLine.unitPriceCents (the real historical sale
// price, snapshotted at the time of sale — see OrderLine's own comment in
// schema.prisma) against the variant's CURRENT Variant.costCents, not a
// historical cost looked up from PriceHistory by sale date. This is a
// deliberate simplification: PriceHistory only starts getting real entries
// once the Purchase Price feature and PO-receive cost sync ship (see
// purchasing.service.js's receivePurchaseOrder), so a sale from before a
// supplier cost was ever recorded has no historical row to look up anyway.
// Margin on long-past orders will drift from what it would have shown at
// the time if a product's cost has since changed — acceptable for now since
// this is the first version of margin reporting, not a point this report
// claims to guarantee.
router.get(
  "/margin",
  requirePermission("catalog:cost:view"),
  asyncHandler(async (req, res) => {
    const { start, end } = req.query.month ? parseMonthRange(req.query.month) : parseDayRange(req.query.date);

    const lines = await prisma.orderLine.findMany({
      where: {
        order: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" } },
      },
      select: {
        quantity: true,
        unitPriceCents: true,
        discountCents: true,
        lineTotalCents: true,
        variantId: true,
        nameSnapshot: true,
        skuSnapshot: true,
        variant: { select: { costCents: true } },
      },
    });

    const byProduct = new Map();
    let revenueCents = 0;
    let costCents = 0;
    let unknownCostQuantity = 0;

    for (const line of lines) {
      const lineRevenueCents = line.lineTotalCents;
      // Null costCents (no PO receipt or backfill has reached this variant
      // yet) contributes 0 cost for that line rather than skipping it or
      // guessing — same "never fabricate a number we don't have" rule as
      // the POS cost-floor check in pos.service.js. unknownCostQuantity
      // surfaces how many units this affects so the report can disclose it
      // rather than silently overstating margin.
      const known = line.variant?.costCents != null;
      const lineCostCents = known ? line.variant.costCents * line.quantity : 0;
      if (!known) unknownCostQuantity += line.quantity;

      revenueCents += lineRevenueCents;
      costCents += lineCostCents;

      const key = line.variantId;
      const existing = byProduct.get(key) ?? {
        variantId: line.variantId,
        name: line.nameSnapshot,
        sku: line.skuSnapshot,
        quantity: 0,
        revenueCents: 0,
        costCents: 0,
        unknownCostQuantity: 0,
      };
      existing.quantity += line.quantity;
      existing.revenueCents += lineRevenueCents;
      existing.costCents += lineCostCents;
      if (!known) existing.unknownCostQuantity += line.quantity;
      byProduct.set(key, existing);
    }

    const products = [...byProduct.values()]
      .map((p) => ({
        ...p,
        marginCents: p.revenueCents - p.costCents,
        marginPercent: p.revenueCents > 0 ? ((p.revenueCents - p.costCents) / p.revenueCents) * 100 : 0,
      }))
      .sort((a, b) => b.marginCents - a.marginCents);

    const marginCents = revenueCents - costCents;

    res.json({
      date: start.toISOString(),
      rangeEnd: end.toISOString(),
      revenueCents,
      costCents,
      marginCents,
      marginPercent: revenueCents > 0 ? (marginCents / revenueCents) * 100 : 0,
      unknownCostQuantity,
      products,
    });
  })
);

module.exports = router;
