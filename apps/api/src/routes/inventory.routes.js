const express = require("express");
const { prisma } = require("@big-eds/database");
const { stockAdjustSchema, stockTransferSchema, countCreateSchema, countSubmitSchema } = require("@big-eds/validation");
const { LOW_STOCK_THRESHOLD } = require("@big-eds/config");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const inventoryService = require("../services/inventory.service");

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
    const { locationId, lowStockOnly } = req.query;

    await inventoryService.expireStaleReservations();

    // Sorted by product/SKU/location, not by recency: sorting by updatedAt
    // made every row jump to the top of the table the moment it was adjusted
    // or transferred, so saving a change made the row you were just looking
    // at disappear from view and reappear elsewhere — confusing during the
    // normal adjust-and-verify flow. A stable sort keeps a row in the same
    // place before and after editing it.
    const balances = await prisma.stockBalance.findMany({
      where: locationId ? { locationId: String(locationId) } : undefined,
      include: {
        variant: { include: { product: true } },
        location: true,
      },
      orderBy: [{ variant: { product: { name: "asc" } } }, { variant: { sku: "asc" } }, { location: { name: "asc" } }],
    });

    const shaped = balances.map((b) => {
      const availableToSell = Math.max(0, b.onHand - b.reserved - b.quarantined);
      return {
        id: b.id,
        variantId: b.variantId,
        sku: b.variant.sku,
        productName: b.variant.product.name,
        variantName: b.variant.name,
        locationId: b.locationId,
        locationName: b.location.name,
        onHand: b.onHand,
        reserved: b.reserved,
        quarantined: b.quarantined,
        availableToSell,
        // Suggestion only — tops back up to 2x the low-stock threshold. A
        // manager must still review and approve any PO created from this
        // (see purchase-orders/:id/approve); nothing here orders automatically.
        suggestedReorderQty:
          availableToSell <= LOW_STOCK_THRESHOLD ? Math.max(0, LOW_STOCK_THRESHOLD * 2 - availableToSell) : 0,
        updatedAt: b.updatedAt,
      };
    });

    const result = lowStockOnly === "true" ? shaped.filter((b) => b.availableToSell <= LOW_STOCK_THRESHOLD) : shaped;

    res.json({ balances: result });
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
    const counts = await prisma.count.findMany({
      include: { location: true, lines: true },
      orderBy: { createdAt: "desc" },
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
