const express = require("express");
const { prisma } = require("@big-eds/database");
const {
  supplierCreateSchema,
  purchaseOrderCreateSchema,
  purchaseOrderApproveSchema,
  goodsReceiptCreateSchema,
} = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const { createWithSequentialNumber } = require("../lib/sequentialNumber");

const router = express.Router();

router.use(requireAuth);

// --- Suppliers ---------------------------------------------------------

router.get(
  "/suppliers",
  requirePermission("purchasing:read"),
  asyncHandler(async (req, res) => {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    res.json({ suppliers });
  })
);

router.post(
  "/suppliers",
  requirePermission("purchasing:write"),
  validateBody(supplierCreateSchema),
  asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json({ supplier });
  })
);

router.patch(
  "/suppliers/:id",
  requirePermission("purchasing:write"),
  asyncHandler(async (req, res) => {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    res.json({ supplier });
  })
);

// --- Purchase Orders -----------------------------------------------------

async function nextPoNumber() {
  const count = await prisma.purchaseOrder.count();
  return `PO-${1000 + count + 1}`;
}

function serializePO(po) {
  return {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    supplier: po.supplier ? { id: po.supplier.id, name: po.supplier.name } : undefined,
    locationId: po.locationId,
    expectedDate: po.expectedDate,
    notes: po.notes,
    approvedAt: po.approvedAt,
    lines: po.lines?.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      skuSnapshot: l.skuSnapshot,
      expectedQty: l.expectedQty,
      receivedQty: l.receivedQty,
      unitCostCents: l.unitCostCents,
      taxCents: l.taxCents,
      freightCents: l.freightCents,
    })),
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  };
}

router.get(
  "/purchase-orders",
  requirePermission("purchasing:read"),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: status ? { status: String(status) } : undefined,
      include: { supplier: true, lines: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ purchaseOrders: purchaseOrders.map(serializePO) });
  })
);

router.get(
  "/purchase-orders/:id",
  requirePermission("purchasing:read"),
  asyncHandler(async (req, res) => {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { supplier: true, lines: { include: { variant: true } }, goodsReceipts: { include: { lines: true } } },
    });
    if (!po) throw new NotFoundError("Purchase order not found");
    res.json({ purchaseOrder: serializePO(po) });
  })
);

router.post(
  "/purchase-orders",
  requirePermission("purchasing:write"),
  validateBody(purchaseOrderCreateSchema),
  asyncHandler(async (req, res) => {
    const { lines, ...poData } = req.body;

    const variants = await prisma.variant.findMany({
      where: { id: { in: lines.map((l) => l.variantId) } },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const po = await createWithSequentialNumber(async () => {
      const poNumber = await nextPoNumber();
      return prisma.purchaseOrder.create({
        data: {
          poNumber,
          status: "DRAFT",
          supplierId: poData.supplierId,
          locationId: poData.locationId,
          expectedDate: poData.expectedDate ? new Date(poData.expectedDate) : undefined,
          notes: poData.notes,
          createdById: req.user.id,
          lines: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              skuSnapshot: variantById.get(l.variantId)?.sku ?? "UNKNOWN",
              expectedQty: l.expectedQty,
              unitCostCents: l.unitCostCents,
              taxCents: l.taxCents ?? 0,
              freightCents: l.freightCents ?? 0,
            })),
          },
        },
        include: { supplier: true, lines: true },
      });
    });

    res.status(201).json({ purchaseOrder: serializePO(po) });
  })
);

router.post(
  "/purchase-orders/:id/submit",
  requirePermission("purchasing:write"),
  asyncHandler(async (req, res) => {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!po) throw new NotFoundError("Purchase order not found");
    if (po.status !== "DRAFT") {
      throw new ConflictError(`Cannot submit a PO in status ${po.status}`);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "AWAITING_APPROVAL" },
      include: { supplier: true, lines: true },
    });

    res.json({ purchaseOrder: serializePO(updated) });
  })
);

// Low-stock reorder suggestions always require this manager approval step
// before a PO can be sent to a vendor — never auto-send.
router.post(
  "/purchase-orders/:id/approve",
  requirePermission("purchasing:approve"),
  validateBody(purchaseOrderApproveSchema),
  asyncHandler(async (req, res) => {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!po) throw new NotFoundError("Purchase order not found");
    if (po.status !== "AWAITING_APPROVAL") {
      throw new ConflictError(`Cannot approve a PO in status ${po.status}`);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: req.body.approve
        ? { status: "SENT_TO_VENDOR", approvedById: req.user.id, approvedAt: new Date() }
        : { status: "DRAFT" },
      include: { supplier: true, lines: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: req.body.approve ? "po.approve" : "po.reject",
        entityType: "PurchaseOrder",
        entityId: po.id,
      },
    });

    res.json({ purchaseOrder: serializePO(updated) });
  })
);

router.get(
  "/purchase-orders/:id/export",
  requirePermission("purchasing:read"),
  asyncHandler(async (req, res) => {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { supplier: true, lines: { include: { variant: { include: { product: true } } } } },
    });
    if (!po) throw new NotFoundError("Purchase order not found");

    // PDF export is a documented MVP requirement; a real render (e.g.
    // Puppeteer/PDFKit) is intentionally deferred until the layout is
    // approved. This returns the structured data a PDF template would
    // consume so the admin UI can build/preview before that's wired up.
    res.json({
      poNumber: po.poNumber,
      supplier: po.supplier.name,
      status: po.status,
      expectedDate: po.expectedDate,
      lines: po.lines.map((l) => ({
        sku: l.skuSnapshot,
        product: l.variant.product.name,
        variant: l.variant.name,
        expectedQty: l.expectedQty,
        unitCostCents: l.unitCostCents,
        lineTotalCents: l.expectedQty * l.unitCostCents + l.taxCents + l.freightCents,
      })),
    });
  })
);

// --- Receiving -----------------------------------------------------------

router.post(
  "/purchase-orders/:id/receive",
  requirePermission("purchasing:receive"),
  validateBody(goodsReceiptCreateSchema),
  asyncHandler(async (req, res) => {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { lines: true },
    });
    if (!po) throw new NotFoundError("Purchase order not found");
    if (!["SENT_TO_VENDOR", "PARTIALLY_RECEIVED"].includes(po.status)) {
      throw new ConflictError(`Cannot receive against a PO in status ${po.status}`);
    }

    const receipt = await prisma.$transaction(async (tx) => {
      const createdReceipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: po.id,
          locationId: req.body.locationId,
          receivedById: req.user.id,
          notes: req.body.notes,
          lines: {
            create: req.body.lines.map((l) => ({
              poLineId: l.poLineId,
              acceptedQty: l.acceptedQty,
              damagedQty: l.damagedQty ?? 0,
              differenceNotes: l.differenceNotes,
            })),
          },
        },
        include: { lines: true },
      });

      for (const receiptLine of req.body.lines) {
        const poLine = po.lines.find((l) => l.id === receiptLine.poLineId);
        if (!poLine) continue;

        const newReceivedQty = poLine.receivedQty + receiptLine.acceptedQty;
        if (newReceivedQty > poLine.expectedQty) {
          throw new ConflictError(
            `Receiving ${receiptLine.acceptedQty} units for SKU ${poLine.skuSnapshot} would exceed the expected quantity`,
            { expectedQty: poLine.expectedQty, alreadyReceived: poLine.receivedQty }
          );
        }

        await tx.pOLine.update({
          where: { id: poLine.id },
          data: { receivedQty: newReceivedQty },
        });

        if (receiptLine.acceptedQty > 0) {
          const balance = await tx.stockBalance.upsert({
            where: { variantId_locationId: { variantId: poLine.variantId, locationId: req.body.locationId } },
            update: {},
            create: { variantId: poLine.variantId, locationId: req.body.locationId },
          });
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { onHand: { increment: receiptLine.acceptedQty } },
          });
          await tx.stockMovement.create({
            data: {
              variantId: poLine.variantId,
              locationId: req.body.locationId,
              type: "RECEIPT",
              quantity: receiptLine.acceptedQty,
              referenceType: "GoodsReceipt",
              referenceId: createdReceipt.id,
              performedById: req.user.id,
            },
          });
        }

        if (receiptLine.damagedQty > 0) {
          const balance = await tx.stockBalance.upsert({
            where: { variantId_locationId: { variantId: poLine.variantId, locationId: req.body.locationId } },
            update: {},
            create: { variantId: poLine.variantId, locationId: req.body.locationId },
          });
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { quarantined: { increment: receiptLine.damagedQty } },
          });
        }
      }

      const refreshedLines = await tx.pOLine.findMany({ where: { purchaseOrderId: po.id } });
      const fullyReceived = refreshedLines.every((l) => l.receivedQty >= l.expectedQty);
      const anyReceived = refreshedLines.some((l) => l.receivedQty > 0);

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: fullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status },
      });

      return createdReceipt;
    });

    res.status(201).json({ goodsReceipt: receipt });
  })
);

module.exports = router;
