const express = require("express");
const PDFDocument = require("pdfkit");
const { prisma } = require("@big-eds/database");
const {
  supplierCreateSchema,
  supplierUpdateSchema,
  purchaseOrderCreateSchema,
  purchaseOrderApproveSchema,
  goodsReceiptCreateSchema,
} = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const { createWithSequentialNumber } = require("../lib/sequentialNumber");
const purchasingService = require("../services/purchasing.service");

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
  validateBody(supplierUpdateSchema),
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
      expectedDate: l.expectedDate,
      pendingNote: l.pendingNote,
    })),
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  };
}

// `status=ACTIVE`/`status=COMPLETED` are admin-UI convenience filters (the
// Purchasing list's two tabs) layered on top of the real PurchaseOrderStatus
// enum — "Completed" means fully RECEIVED, everything else (including
// CANCELED) is still "Active" so it doesn't silently disappear from view.
// A caller can still pass an exact status (e.g. ?status=DRAFT) as before.
function statusFilterFromQuery(status) {
  if (!status) return undefined;
  if (status === "ACTIVE") return { not: "RECEIVED" };
  if (status === "COMPLETED") return "RECEIVED";
  return String(status);
}

router.get(
  "/purchase-orders",
  requirePermission("purchasing:read"),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: status ? { status: statusFilterFromQuery(status) } : undefined,
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
              expectedDate: l.expectedDate ? new Date(l.expectedDate) : undefined,
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

    // Structured JSON a PDF template (or any other export) would consume.
    // The actual PDF render lives at /export.pdf below — this endpoint stays
    // for any caller that wants the raw data rather than a file download.
    res.json({
      poNumber: po.poNumber,
      supplier: po.supplier.name,
      status: po.status,
      lines: po.lines.map((l) => ({
        sku: l.skuSnapshot,
        product: l.variant.product.name,
        variant: l.variant.name,
        expectedQty: l.expectedQty,
        unitCostCents: l.unitCostCents,
        expectedDate: l.expectedDate,
        lineTotalCents: l.expectedQty * l.unitCostCents + l.taxCents + l.freightCents,
      })),
    });
  })
);

function formatCurrencyFromCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

router.get(
  "/purchase-orders/:id/export.pdf",
  requirePermission("purchasing:read"),
  asyncHandler(async (req, res) => {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        lines: { include: { variant: { include: { product: true } } } },
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!po) throw new NotFoundError("Purchase order not found");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${po.poNumber}.pdf"`);

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text("Purchase Order", { continued: true }).fontSize(20).text(`  ${po.poNumber}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#555").text(`Status: ${po.status.replaceAll("_", " ")}`);
    doc.text(`Supplier: ${po.supplier.name}`);
    if (po.createdBy) doc.text(`Created by: ${po.createdBy.firstName} ${po.createdBy.lastName}`);
    if (po.approvedBy) doc.text(`Approved by: ${po.approvedBy.firstName} ${po.approvedBy.lastName}`);
    doc.text(`Created: ${po.createdAt.toLocaleDateString()}`);
    if (po.notes) doc.text(`Notes: ${po.notes}`);
    doc.fillColor("#000");
    doc.moveDown();

    const columns = [
      { label: "SKU", width: 90 },
      { label: "Product", width: 150 },
      { label: "Expected", width: 70 },
      { label: "Qty", width: 40 },
      { label: "Unit Cost", width: 70 },
      { label: "Line Total", width: 70 },
    ];

    function drawRow(y, cells, { bold = false } = {}) {
      let x = doc.page.margins.left;
      doc.fontSize(9).font(bold ? "Helvetica-Bold" : "Helvetica");
      columns.forEach((col, i) => {
        doc.text(String(cells[i] ?? ""), x, y, { width: col.width, ellipsis: true });
        x += col.width;
      });
    }

    let y = doc.y;
    drawRow(y, columns.map((c) => c.label), { bold: true });
    y += 16;
    doc
      .moveTo(doc.page.margins.left, y - 4)
      .lineTo(doc.page.margins.left + columns.reduce((sum, c) => sum + c.width, 0), y - 4)
      .strokeColor("#ccc")
      .stroke();

    let grandTotalCents = 0;
    for (const line of po.lines) {
      if (y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      const lineTotalCents = line.expectedQty * line.unitCostCents + line.taxCents + line.freightCents;
      grandTotalCents += lineTotalCents;
      drawRow(y, [
        line.skuSnapshot,
        line.variant.product.name,
        line.expectedDate ? new Date(line.expectedDate).toLocaleDateString() : "—",
        line.expectedQty,
        formatCurrencyFromCents(line.unitCostCents),
        formatCurrencyFromCents(lineTotalCents),
      ]);
      y += 18;
    }

    y += 8;
    doc
      .moveTo(doc.page.margins.left, y - 4)
      .lineTo(doc.page.margins.left + columns.reduce((sum, c) => sum + c.width, 0), y - 4)
      .strokeColor("#ccc")
      .stroke();
    doc.fontSize(10).font("Helvetica-Bold").text(`Total: ${formatCurrencyFromCents(grandTotalCents)}`, doc.page.margins.left, y, {
      width: columns.reduce((sum, c) => sum + c.width, 0),
      align: "right",
    });

    doc.end();
  })
);

// --- Receiving -----------------------------------------------------------

router.post(
  "/purchase-orders/:id/receive",
  requirePermission("purchasing:receive"),
  validateBody(goodsReceiptCreateSchema),
  asyncHandler(async (req, res) => {
    const receipt = await purchasingService.receivePurchaseOrder({
      purchaseOrderId: req.params.id,
      locationId: req.body.locationId,
      notes: req.body.notes,
      lines: req.body.lines,
      receivedById: req.user.id,
    });

    res.status(201).json({ goodsReceipt: receipt });
  })
);

module.exports = router;
