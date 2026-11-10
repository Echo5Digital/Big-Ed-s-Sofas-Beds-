const { prisma } = require("@big-eds/database");
const purchasingService = require("./purchasing.service");

// Runs against the real dev database (same convention as pos.service.test.js
// and catalog.routes.test.js — no Prisma mock layer). Covers the
// receivePurchaseOrder transaction, with particular focus on the
// Variant.costCents ("last known supplier cost") + PriceHistory sync added
// alongside the Purchase Price feature: receiving real stock against a PO
// line must update the variant's cost to that line's unitCostCents and leave
// an auditable PriceHistory row, while an all-damaged or zero-quantity
// receipt line (no real stock actually accepted) must NOT touch cost at all.
describe("purchasing.service — receivePurchaseOrder cost sync", () => {
  let supplier;
  let location;
  let product;
  let variant;

  beforeAll(async () => {
    supplier = await prisma.supplier.create({
      data: { name: `Cost Sync Test Supplier ${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "Cost Sync Test Warehouse", type: "WAREHOUSE", isActive: true },
    });
    product = await prisma.product.create({
      data: {
        name: `Cost Sync Test Product ${Date.now()}`,
        slug: `cost-sync-test-${Date.now()}`,
        status: "ACTIVE",
      },
    });
    variant = await prisma.variant.create({
      data: {
        productId: product.id,
        sku: `COST-SYNC-TEST-${Date.now()}`,
        name: "Default",
        priceCents: 100000,
        costCents: null,
      },
    });
  });

  afterAll(async () => {
    await prisma.priceHistory.deleteMany({ where: { variantId: variant.id } });
    await prisma.receiptLine.deleteMany({ where: { poLine: { variantId: variant.id } } });
    await prisma.goodsReceipt.deleteMany({ where: { purchaseOrder: { lines: { some: { variantId: variant.id } } } } });
    await prisma.pOLine.deleteMany({ where: { variantId: variant.id } });
    await prisma.purchaseOrder.deleteMany({ where: { supplierId: supplier.id } });
    await prisma.stockMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.stockBalance.deleteMany({ where: { variantId: variant.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.supplier.delete({ where: { id: supplier.id } });
  });

  async function createSentPO(unitCostCents, expectedQty = 10) {
    const count = await prisma.purchaseOrder.count();
    return prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-COST-SYNC-${count + 1}-${Date.now()}`,
        status: "SENT_TO_VENDOR",
        supplierId: supplier.id,
        locationId: location.id,
        lines: {
          create: [{ variantId: variant.id, skuSnapshot: variant.sku, expectedQty, unitCostCents }],
        },
      },
      include: { lines: true },
    });
  }

  it("sets Variant.costCents to the received line's unitCostCents and writes a PriceHistory row", async () => {
    const po = await createSentPO(42000);
    const poLine = po.lines[0];

    await purchasingService.receivePurchaseOrder({
      purchaseOrderId: po.id,
      locationId: location.id,
      lines: [{ poLineId: poLine.id, acceptedQty: 10 }],
      receivedById: null,
    });

    const updated = await prisma.variant.findUnique({ where: { id: variant.id } });
    expect(updated.costCents).toBe(42000);

    const history = await prisma.priceHistory.findFirst({
      where: { variantId: variant.id, costCents: 42000 },
      orderBy: { effectiveAt: "desc" },
    });
    expect(history).not.toBeNull();
    expect(history.priceCents).toBe(100000);
  });

  it("updates costCents again on a later receipt at a different price (most-recent-wins)", async () => {
    const po = await createSentPO(55000);
    const poLine = po.lines[0];

    await purchasingService.receivePurchaseOrder({
      purchaseOrderId: po.id,
      locationId: location.id,
      lines: [{ poLineId: poLine.id, acceptedQty: 10 }],
      receivedById: null,
    });

    const updated = await prisma.variant.findUnique({ where: { id: variant.id } });
    expect(updated.costCents).toBe(55000);
  });

  it("does NOT touch costCents when a receipt line accepts zero quantity (nothing actually received)", async () => {
    const before = await prisma.variant.findUnique({ where: { id: variant.id } });
    const po = await createSentPO(99999);
    const poLine = po.lines[0];

    await purchasingService.receivePurchaseOrder({
      purchaseOrderId: po.id,
      locationId: location.id,
      lines: [{ poLineId: poLine.id, acceptedQty: 0, damagedQty: 0 }],
      receivedById: null,
    });

    const after = await prisma.variant.findUnique({ where: { id: variant.id } });
    expect(after.costCents).toBe(before.costCents);
    expect(after.costCents).not.toBe(99999);
  });

  it("does NOT touch costCents when every received unit is damaged (acceptedQty 0, damagedQty > 0)", async () => {
    const before = await prisma.variant.findUnique({ where: { id: variant.id } });
    const po = await createSentPO(77777);
    const poLine = po.lines[0];

    await purchasingService.receivePurchaseOrder({
      purchaseOrderId: po.id,
      locationId: location.id,
      lines: [{ poLineId: poLine.id, acceptedQty: 0, damagedQty: 5 }],
      receivedById: null,
    });

    const after = await prisma.variant.findUnique({ where: { id: variant.id } });
    expect(after.costCents).toBe(before.costCents);
    expect(after.costCents).not.toBe(77777);

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.quarantined).toBeGreaterThanOrEqual(5);
  });

  it("rejects receiving against a PO that isn't SENT_TO_VENDOR or PARTIALLY_RECEIVED", async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-COST-SYNC-DRAFT-${Date.now()}`,
        status: "DRAFT",
        supplierId: supplier.id,
        locationId: location.id,
        lines: { create: [{ variantId: variant.id, skuSnapshot: variant.sku, expectedQty: 5, unitCostCents: 10000 }] },
      },
      include: { lines: true },
    });

    await expect(
      purchasingService.receivePurchaseOrder({
        purchaseOrderId: po.id,
        locationId: location.id,
        lines: [{ poLineId: po.lines[0].id, acceptedQty: 5 }],
        receivedById: null,
      })
    ).rejects.toThrow(/Cannot receive against a PO in status DRAFT/);
  });
});
