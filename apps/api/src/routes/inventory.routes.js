const express = require("express");
const { prisma, Prisma } = require("@big-eds/database");
const { stockAdjustSchema, stockTransferSchema, countCreateSchema, countSubmitSchema } = require("@big-eds/validation");
const { LOW_STOCK_THRESHOLD } = require("@big-eds/config");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const inventoryService = require("../services/inventory.service");
const { escapeLikeWildcards } = require("../lib/searchText");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/locations",
  requirePermission("inventory:read"),
  asyncHandler(async (req, res) => {
    const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
    res.json({ locations });
  })
);

router.get(
  "/balances",
  requirePermission("inventory:read"),
  asyncHandler(async (req, res) => {
    const { locationId, lowStockOnly, supplierId, q } = req.query;

    await inventoryService.expireStaleReservations();

    // lowStockOnly used to be filtered in JS after fetching every (variant,
    // location) row in the store — availableToSell is a computed expression
    // (onHand - reserved - quarantined), not a stored column, so Prisma's
    // query builder can't filter on it directly. At catalog scale that meant
    // transferring the *entire* StockBalance table (joined to variant/
    // product/supplier/location) over the network just to keep the handful
    // of low-stock rows, every time this view loaded with the low-stock
    // toggle on — the same class of problem dashboard.routes.js's own
    // low-stock tile already solved with a raw SQL comparison. This does the
    // same GREATEST(onHand - reserved - quarantined, 0) <= threshold
    // comparison in SQL, combined with the existing locationId/supplierId/q
    // filters, via Prisma.sql/Prisma.join so every value is still a bound
    // parameter — never raw string concatenation.
    const conditions = [];
    if (locationId) conditions.push(Prisma.sql`sb."locationId" = ${String(locationId)}`);
    if (supplierId) conditions.push(Prisma.sql`p."supplierId" = ${String(supplierId)}`);
    if (q) {
      const likeQuery = `%${escapeLikeWildcards(String(q))}%`;
      conditions.push(Prisma.sql`(v.sku ILIKE ${likeQuery} ESCAPE '\\' OR p.name ILIKE ${likeQuery} ESCAPE '\\')`);
    }
    if (lowStockOnly === "true") {
      conditions.push(Prisma.sql`GREATEST(sb."onHand" - sb.reserved - sb.quarantined, 0) <= ${LOW_STOCK_THRESHOLD}`);
    }
    const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

    // Sorted by product/SKU/location, not by recency: sorting by updatedAt
    // made every row jump to the top of the table the moment it was adjusted
    // or transferred, so saving a change made the row you were just looking
    // at disappear from view and reappear elsewhere — confusing during the
    // normal adjust-and-verify flow. A stable sort keeps a row in the same
    // place before and after editing it.
    const rows = await prisma.$queryRaw`
      SELECT
        sb.id AS id,
        sb."variantId" AS "variantId",
        v.sku AS sku,
        p.name AS "productName",
        v.name AS "variantName",
        v."costCents" AS "costCents",
        p."supplierId" AS "supplierId",
        s.name AS "supplierName",
        sb."locationId" AS "locationId",
        l.name AS "locationName",
        sb."onHand" AS "onHand",
        sb.reserved AS reserved,
        sb.quarantined AS quarantined,
        GREATEST(sb."onHand" - sb.reserved - sb.quarantined, 0) AS "availableToSell",
        sb."updatedAt" AS "updatedAt"
      FROM "StockBalance" sb
      JOIN "Variant" v ON v.id = sb."variantId"
      JOIN "Product" p ON p.id = v."productId"
      JOIN "Location" l ON l.id = sb."locationId"
      LEFT JOIN "Supplier" s ON s.id = p."supplierId"
      ${whereClause}
      ORDER BY p.name ASC, v.sku ASC, l.name ASC
    `;

    const balances = rows.map((b) => ({
      id: b.id,
      variantId: b.variantId,
      sku: b.sku,
      productName: b.productName,
      variantName: b.variantName,
      costCents: b.costCents,
      supplierId: b.supplierId,
      supplierName: b.supplierName,
      locationId: b.locationId,
      locationName: b.locationName,
      onHand: b.onHand,
      reserved: b.reserved,
      quarantined: b.quarantined,
      availableToSell: b.availableToSell,
      // Suggestion only — tops back up to 2x the low-stock threshold. A
      // manager must still review and approve any PO created from this
      // (see purchase-orders/:id/approve); nothing here orders automatically.
      suggestedReorderQty:
        b.availableToSell <= LOW_STOCK_THRESHOLD ? Math.max(0, LOW_STOCK_THRESHOLD * 2 - b.availableToSell) : 0,
      updatedAt: b.updatedAt,
    }));

    res.json({ balances });
  })
);

router.get(
  "/movements",
  requirePermission("inventory:read"),
  asyncHandler(async (req, res) => {
    const { variantId, locationId, take = "50" } = req.query;

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(variantId ? { variantId: String(variantId) } : {}),
        ...(locationId ? { locationId: String(locationId) } : {}),
      },
      include: {
        variant: { select: { sku: true, name: true } },
        location: { select: { name: true } },
        performedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Number(take) || 50),
    });

    res.json({ movements });
  })
);

router.post(
  "/adjust",
  requirePermission("inventory:adjust"),
  validateBody(stockAdjustSchema),
  asyncHandler(async (req, res) => {
    const movement = await inventoryService.adjustStock({
      ...req.body,
      performedById: req.user.id,
    });
    res.status(201).json({ movement });
  })
);

router.post(
  "/transfer",
  requirePermission("inventory:adjust"),
  validateBody(stockTransferSchema),
  asyncHandler(async (req, res) => {
    const transfer = await inventoryService.transferStock({
      ...req.body,
      performedById: req.user.id,
    });
    res.status(201).json({ transfer });
  })
);

router.get(
  "/counts",
  requirePermission("inventory:read"),
  asyncHandler(async (req, res) => {
    // Hard-capped (same convention as orders.routes.js/reports.routes.js) —
    // previously had no take at all, so every cycle count ever submitted,
    // with all of its lines, was fetched on every call. No admin UI calls
    // this endpoint today, so a cap rather than true pagination for now.
    const counts = await prisma.count.findMany({
      include: { location: true, lines: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ counts });
  })
);

router.post(
  "/counts",
  requirePermission("inventory:adjust"),
  validateBody(countCreateSchema),
  asyncHandler(async (req, res) => {
    const { locationId, notes, lines } = req.body;
    const count = await prisma.count.create({
      data: {
        locationId,
        notes,
        lines: { create: lines.map((l) => ({ variantId: l.variantId, expectedQty: l.expectedQty })) },
      },
      include: { lines: true },
    });
    res.status(201).json({ count });
  })
);

router.post(
  "/counts/:id/submit",
  requirePermission("inventory:adjust"),
  validateBody(countSubmitSchema),
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch inside the transaction (not reused from an earlier
      // findUnique outside it) so a retried/duplicate submit of the same
      // count sees the COMPLETED status set by a prior call and is rejected
      // instead of re-applying every discrepancy a second time.
      const count = await tx.count.findUnique({ where: { id: req.params.id }, include: { lines: true } });
      if (!count) throw new NotFoundError("Count not found");
      if (count.status !== "OPEN") {
        throw new ConflictError("This count has already been submitted", { status: count.status });
      }

      for (const submitted of req.body.lines) {
        const line = count.lines.find((l) => l.id === submitted.lineId);
        if (!line) continue;

        const discrepancy = submitted.countedQty - line.expectedQty;
        await tx.countLine.update({
          where: { id: line.id },
          data: { countedQty: submitted.countedQty, discrepancy },
        });

        if (discrepancy !== 0) {
          const type = discrepancy > 0 ? "ADJUSTMENT_INCREASE" : "ADJUSTMENT_DECREASE";
          const quantity = Math.abs(discrepancy);

          // getOrCreateBalance takes a row-level SELECT ... FOR UPDATE lock
          // before this transaction mutates onHand — the same protection
          // adjustStock() uses elsewhere, needed here because a concurrent
          // manual adjustment or another count submission could otherwise
          // race with this read-then-write.
          const balance = await inventoryService.getOrCreateBalance(tx, line.variantId, count.locationId);
          const nextOnHand = type === "ADJUSTMENT_INCREASE" ? balance.onHand + quantity : balance.onHand - quantity;

          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { onHand: nextOnHand },
          });

          await tx.stockMovement.create({
            data: {
              variantId: line.variantId,
              locationId: count.locationId,
              type,
              quantity,
              reasonCode: "cycle_count_discrepancy",
              referenceType: "Count",
              referenceId: count.id,
              performedById: req.user.id,
            },
          });
        }
      }

      return tx.count.update({
        where: { id: count.id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: { lines: true },
      });
    });

    res.json({ count: result });
  })
);

module.exports = router;
