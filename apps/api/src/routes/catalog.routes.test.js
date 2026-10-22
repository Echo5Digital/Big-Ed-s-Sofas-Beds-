const { prisma } = require("@big-eds/database");

// Runs against the real dev database (same convention as auth.routes.test.js
// and pos.service.test.js — no Prisma mock layer). Regression test for a bug
// where PATCH /catalog/products/:id matched the variant to update by the
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
