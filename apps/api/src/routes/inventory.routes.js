const express = require("express");
const { prisma } = require("@big-eds/database");
const { stockAdjustSchema, stockTransferSchema, countCreateSchema, countSubmitSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError } = require("../lib/errors");
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

    const balances = await prisma.stockBalance.findMany({
      where: locationId ? { locationId: String(locationId) } : undefined,
      include: {
        variant: { include: { product: true } },
        location: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const shaped = balances.map((b) => ({
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
      availableToSell: Math.max(0, b.onHand - b.reserved - b.quarantined),
      updatedAt: b.updatedAt,
    }));

    const result = lowStockOnly === "true" ? shaped.filter((b) => b.availableToSell <= 2) : shaped;

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
    const count = await prisma.count.findUnique({ where: { id: req.params.id }, include: { lines: true } });
    if (!count) throw new NotFoundError("Count not found");

    const result = await prisma.$transaction(async (tx) => {
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

          const balance = await tx.stockBalance.upsert({
            where: { variantId_locationId: { variantId: line.variantId, locationId: count.locationId } },
            update: {},
            create: { variantId: line.variantId, locationId: count.locationId },
          });

          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { onHand: type === "ADJUSTMENT_INCREASE" ? { increment: quantity } : { decrement: quantity } },
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
