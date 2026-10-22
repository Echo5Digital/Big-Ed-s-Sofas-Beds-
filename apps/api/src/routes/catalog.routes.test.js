const { prisma } = require("@big-eds/database");

// Runs against the real dev database (same convention as auth.routes.test.js
// and pos.service.test.js — no Prisma mock layer). Regression test for a bug
// where POST /products created the Product/Variant rows and the variants'
// StockBalance rows as two separate, non-transactional calls: a transient
// failure between them (seen in production — 5 real ACTIVE products ended up
// with zero StockBalance rows after a brief DB connectivity blip) left a
// product that looked normal everywhere except it was completely invisible
// on the Inventory page (GET /inventory/balances starts from StockBalance,
// not Variant) and showed a misleading "Available: 0" on the Products page
// instead of indicating it had no stock record at all. The fix wraps both
// the product/variant creation and the StockBalance creation in a single
// prisma.$transaction so they can only ever commit together.
describe("catalog.routes — POST /products StockBalance atomicity", () => {
  let location;
  let product;

  beforeAll(async () => {
    location = await prisma.location.create({
      data: { name: "Atomicity Test Location", type: "WAREHOUSE", isActive: true },
    });
  });

  afterAll(async () => {
    if (product) {
      await prisma.stockBalance.deleteMany({ where: { variantId: { in: product.variants.map((v) => v.id) } } });
      await prisma.variant.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
    await prisma.location.delete({ where: { id: location.id } });
  });

  it("creates a StockBalance row for every variant/active-location pair in the same transaction as the product", async () => {
    const slug = `atomicity-test-${Date.now()}`;
    const sku = `ATOMICITY-TEST-${Date.now()}`;

    // Mirrors the exact shape of POST /products' handler in catalog.routes.js:
    // product + variants created, then StockBalance rows for every active
    // location, both inside one prisma.$transaction.
    product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: "Atomicity Test Product",
          slug,
          status: "ACTIVE",
          variants: { create: [{ sku, name: "Atomicity Test Product", priceCents: 1000 }] },
        },
        include: { variants: true },
      });

      const locations = await tx.location.findMany({ where: { isActive: true }, select: { id: true } });
      await tx.stockBalance.createMany({
        data: created.variants.flatMap((v) => locations.map((loc) => ({ variantId: v.id, locationId: loc.id }))),
        skipDuplicates: true,
      });

      return created;
    });

    const variant = product.variants[0];
    const balances = await prisma.stockBalance.findMany({ where: { variantId: variant.id } });
    const activeLocationCount = await prisma.location.count({ where: { isActive: true } });

    expect(balances.length).toBe(activeLocationCount);
    expect(balances.some((b) => b.locationId === location.id)).toBe(true);
  });
});

// Regression test for a separate bug where PATCH /catalog/products/:id matched the variant to update by the
// newly submitted `sku` value (`where: { sku: v.sku }`). Since sku is itself
// an editable field, changing it meant the lookup could never match the
// existing row, so the update silently became a no-op (updateMany does not
// error on zero matches) — editing a SKU from the admin UI never persisted.
describe("catalog.routes — PATCH /products/:id variant lookup", () => {
  const testSlug = `catalog-patch-test-${Date.now()}`;
  let product;
  let variant;

  beforeAll(async () => {
    product = await prisma.product.create({
      data: {
        name: "Catalog Patch Test Product",
        slug: testSlug,
        status: "DRAFT",
        variants: {
          create: {
            sku: `OLD-SKU-${Date.now()}`,
            name: "Catalog Patch Test Product",
            priceCents: 1000,
          },
        },
      },
      include: { variants: true },
    });
    variant = product.variants[0];
  });

  afterAll(async () => {
    await prisma.variant.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("matching by the newly submitted sku fails to find the existing row (the bug)", async () => {
    const newSku = `NEW-SKU-${Date.now()}`;

    const result = await prisma.variant.updateMany({
      where: { productId: product.id, sku: newSku },
      data: { sku: newSku, name: variant.name, priceCents: 1500 },
    });

    expect(result.count).toBe(0);

    const reloaded = await prisma.variant.findUnique({ where: { id: variant.id } });
    expect(reloaded.sku).toBe(variant.sku);
    expect(reloaded.priceCents).toBe(1000);
  });

  it("matching by id correctly updates the sku and other fields (the fix)", async () => {
    const newSku = `NEW-SKU-${Date.now()}`;

    const result = await prisma.variant.updateMany({
      where: { productId: product.id, id: variant.id },
      data: { sku: newSku, name: variant.name, priceCents: 1500 },
    });

    expect(result.count).toBe(1);

    const reloaded = await prisma.variant.findUnique({ where: { id: variant.id } });
    expect(reloaded.sku).toBe(newSku);
    expect(reloaded.priceCents).toBe(1500);
  });
});
