const { prisma } = require("@big-eds/database");
const inventoryService = require("../services/inventory.service");
const { pickDisplayCategory } = require("./catalog.routes");

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

// Covers the New Product form's optional "Inventory" section: a count
// entered for a location at creation time must become a real stock receipt
// (StockMovement + AuditLog, via the same inventoryService.adjustStock() the
// Inventory page's "Adjust" button uses), not a cosmetic StockBalance.onHand
// value written directly — see catalog.routes.js POST /products.
describe("catalog.routes — POST /products initial stock", () => {
  let location;
  let product;

  beforeAll(async () => {
    location = await prisma.location.create({
      data: { name: "Initial Stock Test Location", type: "WAREHOUSE", isActive: true },
    });

    const slug = `initial-stock-test-${Date.now()}`;
    const sku = `INITIAL-STOCK-TEST-${Date.now()}`;

    // Mirrors catalog.routes.js: product/variant/StockBalance(onHand: 0)
    // created transactionally, then initialStock applied via adjustStock —
    // exactly what POST /products does when initialStock is submitted.
    product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: "Initial Stock Test Product",
          slug,
          status: "ACTIVE",
          variants: { create: [{ sku, name: "Initial Stock Test Product", priceCents: 1000 }] },
        },
        include: { variants: true },
      });
      await tx.stockBalance.create({ data: { variantId: created.variants[0].id, locationId: location.id } });
      return created;
    });

    await inventoryService.adjustStock({
      variantId: product.variants[0].id,
      locationId: location.id,
      type: "ADJUSTMENT_INCREASE",
      quantity: 4,
      reasonCode: "initial_stock",
      performedById: null,
    });
  });

  afterAll(async () => {
    const variantId = product.variants[0].id;
    await prisma.stockMovement.deleteMany({ where: { variantId } });
    await prisma.stockBalance.deleteMany({ where: { variantId } });
    await prisma.variant.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
  });

  it("sets StockBalance.onHand to the entered count", async () => {
    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: product.variants[0].id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(4);
  });

  it("writes a real StockMovement row, not just a silent onHand update", async () => {
    const movements = await prisma.stockMovement.findMany({ where: { variantId: product.variants[0].id } });
    expect(movements.length).toBe(1);
    expect(movements[0].type).toBe("ADJUSTMENT_INCREASE");
    expect(movements[0].quantity).toBe(4);
    expect(movements[0].reasonCode).toBe("initial_stock");
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

// Regression test for a bug where the admin Products list's Category column
// showed whichever category happened to land in Product.categoryId (the
// "primary" category, which CategoryMultiSelect sets to whichever box was
// checked first) even when a more specific subcategory was also selected —
// e.g. showing "Bedroom" instead of "Beds". pickDisplayCategory should always
// prefer a subcategory (parentId set) over a top-level category, regardless
// of which one is marked primary.
describe("catalog.routes — pickDisplayCategory", () => {
  const parent = { id: "parent-1", name: "Bedroom", slug: "bedroom", parentId: null };
  const child = { id: "child-1", name: "Beds", slug: "beds", parentId: "parent-1" };

  it("prefers the subcategory when the primary category is a top-level parent", () => {
    const product = { category: parent, categoryTags: [{ category: child }] };
    expect(pickDisplayCategory(product)).toEqual({ id: child.id, name: child.name, slug: child.slug });
  });

  it("prefers the subcategory when it is the primary and the parent is a secondary tag", () => {
    const product = { category: child, categoryTags: [{ category: parent }] };
    expect(pickDisplayCategory(product)).toEqual({ id: child.id, name: child.name, slug: child.slug });
  });

  it("falls back to the primary (top-level) category when no subcategory is selected", () => {
    const product = { category: parent, categoryTags: [] };
    expect(pickDisplayCategory(product)).toEqual({ id: parent.id, name: parent.name, slug: parent.slug });
  });

  it("returns null when the product has no category at all", () => {
    expect(pickDisplayCategory({ category: null, categoryTags: [] })).toBeNull();
  });
});

// Covers the new admin "Deals" checkbox column: PATCH /products/:id with
// { isDeal: true } must persist, and the storefront Deals page's product
// filter should pick it up. isDeal defaults to false for existing/new
// products that haven't been flagged.
describe("catalog.routes — Product.isDeal", () => {
  let product;

  beforeAll(async () => {
    product = await prisma.product.create({
      data: {
        name: "Deals Flag Test Product",
        slug: `deals-flag-test-${Date.now()}`,
        status: "DRAFT",
        variants: { create: { sku: `DEALS-FLAG-TEST-${Date.now()}`, name: "Deals Flag Test Product", priceCents: 1000 } },
      },
      include: { variants: true },
    });
  });

  afterAll(async () => {
    await prisma.variant.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("defaults to false", () => {
    expect(product.isDeal).toBe(false);
  });

  it("persists true when toggled on, mirroring the admin listing checkbox", async () => {
    const updated = await prisma.product.update({ where: { id: product.id }, data: { isDeal: true } });
    expect(updated.isDeal).toBe(true);
  });
});
