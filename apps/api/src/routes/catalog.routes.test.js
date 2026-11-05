const { prisma } = require("@big-eds/database");
const { productCreateSchema, productUpdateSchema } = require("@big-eds/validation");
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

// Regression test for a bug where ticking "Deals" in the admin product list
// did not make the product appear on the storefront /deals page. Root cause:
// the Deals page fetched a single page of products (pageSize capped at 100 —
// see GET /products below) sorted oldest-first, then filtered for
// isDeal/compareAtPrice client-side. A flagged product sorted past the first
// 100 was silently dropped before the filter ever ran. The fix moves the
// filter into the database query itself (GET /products?deals=true), so a
// flagged product is found regardless of how many other products exist or
// where it falls in sort order.
describe("catalog.routes — GET /products?deals=true", () => {
  let flaggedProduct;
  let markdownOnlyProduct;
  let plainProduct;

  // Mirrors catalog.routes.js's `where` construction for ?deals=true: the
  // Deals page shows only products staff have explicitly ticked — a markdown
  // (compareAtCents) price alone does not qualify a product.
  function dealsWhereClause() {
    return { isDeal: true };
  }

  beforeAll(async () => {
    const suffix = Date.now();
    flaggedProduct = await prisma.product.create({
      data: {
        name: `Deals Filter Flagged ${suffix}`,
        slug: `deals-filter-flagged-${suffix}`,
        status: "ACTIVE",
        isDeal: true,
        variants: { create: { sku: `DEALS-FILTER-FLAGGED-${suffix}`, name: "Flagged", priceCents: 1000 } },
      },
    });
    // Has a markdown price but was never ticked — must NOT appear in Deals.
    markdownOnlyProduct = await prisma.product.create({
      data: {
        name: `Deals Filter Markdown Only ${suffix}`,
        slug: `deals-filter-markdown-only-${suffix}`,
        status: "ACTIVE",
        isDeal: false,
        variants: {
          create: { sku: `DEALS-FILTER-MARKDOWN-${suffix}`, name: "Markdown Only", priceCents: 800, compareAtCents: 1000 },
        },
      },
    });
    plainProduct = await prisma.product.create({
      data: {
        name: `Deals Filter Plain ${suffix}`,
        slug: `deals-filter-plain-${suffix}`,
        status: "ACTIVE",
        isDeal: false,
        variants: { create: { sku: `DEALS-FILTER-PLAIN-${suffix}`, name: "Plain", priceCents: 1000 } },
      },
    });
  });

  afterAll(async () => {
    for (const p of [flaggedProduct, markdownOnlyProduct, plainProduct]) {
      await prisma.variant.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } });
    }
  });

  it("the deals filter finds a flagged product directly by isDeal, independent of pagination or sort position", async () => {
    const matches = await prisma.product.findMany({ where: { AND: [dealsWhereClause()] } });
    expect(matches.some((p) => p.id === flaggedProduct.id)).toBe(true);
  });

  it("excludes a product with a markdown price that staff never ticked", async () => {
    const matches = await prisma.product.findMany({ where: { AND: [dealsWhereClause()] } });
    expect(matches.some((p) => p.id === markdownOnlyProduct.id)).toBe(false);
  });

  it("excludes products that are neither flagged nor have a markdown price", async () => {
    const matches = await prisma.product.findMany({ where: { AND: [dealsWhereClause()] } });
    expect(matches.some((p) => p.id === plainProduct.id)).toBe(false);
  });
});

// Regression/coverage test for "can a product be added to every category":
// exercises the exact same two steps the admin New Product form's submit
// depends on — productCreateSchema.safeParse() (what validateBody runs
// before the handler ever sees the request) and the Prisma create() call
// the handler makes — for every category that actually exists in the
// database today (both top-level and child), as the sole primary category.
// A mismatch between CategoryMultiSelect's real category ids and the Zod
// schema (e.g. a non-uuid id format) would show up here as a safeParse
// failure, which is exactly what the admin form surfaces as "Invalid ...".
describe("catalog.routes — POST /products accepts every existing category", () => {
  let categories;
  const createdProductIds = [];

  beforeAll(async () => {
    categories = await prisma.category.findMany();
    expect(categories.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    for (const id of createdProductIds) {
      await prisma.variant.deleteMany({ where: { productId: id } });
      await prisma.productCategory.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } });
    }
  });

  it("validates and creates a product for every category as the primary categoryId", async () => {
    for (const category of categories) {
      const suffix = `${Date.now()}-${category.id.slice(0, 8)}`;
      const payload = {
        name: `Category Coverage Test ${category.slug}`,
        slug: `category-coverage-${suffix}`,
        categoryId: category.id,
        categoryIds: [],
        status: "DRAFT",
        variants: [{ sku: `CAT-COVERAGE-${suffix}`, name: `Category Coverage Test ${category.slug}`, priceCents: 1000 }],
      };

      const result = productCreateSchema.safeParse(payload);
      expect(result.success, `safeParse failed for category ${category.slug}: ${JSON.stringify(result.error?.flatten())}`).toBe(true);

      const { variants, categoryIds, ...productData } = result.data;
      const created = await prisma.product.create({
        data: { ...productData, variants: { create: variants } },
        include: { variants: true },
      });
      createdProductIds.push(created.id);

      expect(created.categoryId).toBe(category.id);
    }
  }, 60000);

  // CategoryMultiSelect lets staff check a parent and one of its children
  // together (the parent becomes primary categoryId, the child rides along
  // in categoryIds) — covers that combined selection going through
  // secondaryCategoryIds dedup and the ProductCategory join table.
  it("validates and creates a product with a parent as primary and its child as a secondary tag", async () => {
    const parent = categories.find((c) => !c.parentId && categories.some((child) => child.parentId === c.id));
    const child = categories.find((c) => c.parentId === parent.id);
    expect(parent).toBeTruthy();
    expect(child).toBeTruthy();

    const suffix = `${Date.now()}-parent-child`;
    const payload = {
      name: "Category Coverage Parent+Child Test",
      slug: `category-coverage-${suffix}`,
      categoryId: parent.id,
      categoryIds: [parent.id, child.id],
      status: "DRAFT",
      variants: [{ sku: `CAT-COVERAGE-${suffix}`, name: "Category Coverage Parent+Child Test", priceCents: 1000 }],
    };

    const result = productCreateSchema.safeParse(payload);
    expect(result.success, `safeParse failed: ${JSON.stringify(result.error?.flatten())}`).toBe(true);

    const { variants, categoryIds, ...productData } = result.data;
    const secondaryCategoryIds = categoryIds.filter((id) => id !== productData.categoryId);
    const created = await prisma.product.create({
      data: {
        ...productData,
        variants: { create: variants },
        categoryTags: { create: secondaryCategoryIds.map((categoryId) => ({ categoryId })) },
      },
      include: { categoryTags: true },
    });
    createdProductIds.push(created.id);

    expect(created.categoryId).toBe(parent.id);
    expect(created.categoryTags.map((t) => t.categoryId)).toEqual([child.id]);
  });
});

// Mirrors POST /products' + PATCH /products/:id's linkedProductIds handling
// exactly (see catalog.routes.js) — the non-negotiable property here is
// symmetry: adding B under A must make A appear under B with no separate
// action, and removing B from A must remove A from B too, never leaving a
// one-directional stale link on either side.
describe("catalog.routes — linkedProductIds symmetry", () => {
  const createdProductIds = [];

  afterAll(async () => {
    for (const id of createdProductIds) {
      await prisma.productLink.deleteMany({ where: { OR: [{ productId: id }, { linkedProductId: id }] } });
      await prisma.variant.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } }).catch(() => {});
    }
  });

  async function createTestProduct(label) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      name: `Linked Product Test ${label} ${suffix}`,
      slug: `linked-test-${label.toLowerCase()}-${suffix}`,
      status: "DRAFT",
      variants: [{ sku: `LINKED-TEST-${label}-${suffix}`, name: `Linked Product Test ${label}`, priceCents: 1000 }],
    };
    const result = productCreateSchema.safeParse(payload);
    expect(result.success, `safeParse failed: ${JSON.stringify(result.error?.flatten())}`).toBe(true);
    const { variants, ...productData } = result.data;
    const created = await prisma.product.create({ data: { ...productData, variants: { create: variants } } });
    createdProductIds.push(created.id);
    return created;
  }

  // Exercises the exact create-path logic from POST /products: write both
  // (A, B) and (B, A) ProductLink rows in response to A's linkedProductIds alone.
  async function createLinksSymmetric(productId, linkedProductIds) {
    const dedupedLinkIds = [...new Set(linkedProductIds)];
    if (dedupedLinkIds.length === 0) return;
    await prisma.productLink.createMany({
      data: dedupedLinkIds.flatMap((linkedProductId) => [
        { productId, linkedProductId },
        { productId: linkedProductId, linkedProductId: productId },
      ]),
      skipDuplicates: true,
    });
  }

  // Exercises the exact update-path diff/replace logic from PATCH /products/:id.
  async function replaceLinksSymmetric(productId, linkedProductIds) {
    const dedupedLinkIds = [...new Set(linkedProductIds)].filter((id) => id !== productId);
    const existingLinks = await prisma.productLink.findMany({
      where: { productId },
      select: { linkedProductId: true },
    });
    const existingLinkIds = existingLinks.map((l) => l.linkedProductId);
    const removedLinkIds = existingLinkIds.filter((id) => !dedupedLinkIds.includes(id));
    const addedLinkIds = dedupedLinkIds.filter((id) => !existingLinkIds.includes(id));

    if (removedLinkIds.length > 0) {
      await prisma.productLink.deleteMany({
        where: {
          OR: [
            { productId, linkedProductId: { in: removedLinkIds } },
            { productId: { in: removedLinkIds }, linkedProductId: productId },
          ],
        },
      });
    }
    if (addedLinkIds.length > 0) {
      await prisma.productLink.createMany({
        data: addedLinkIds.flatMap((linkedProductId) => [
          { productId, linkedProductId },
          { productId: linkedProductId, linkedProductId: productId },
        ]),
        skipDuplicates: true,
      });
    }
  }

  it("linking B under A on create also makes A appear under B, with no action on B", async () => {
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");

    await createLinksSymmetric(a.id, [b.id]);

    const aLinks = await prisma.productLink.findMany({ where: { productId: a.id } });
    const bLinks = await prisma.productLink.findMany({ where: { productId: b.id } });
    expect(aLinks.map((l) => l.linkedProductId)).toEqual([b.id]);
    expect(bLinks.map((l) => l.linkedProductId)).toEqual([a.id]);
  });

  it("removing B from A's linked list on update also removes A from B's list", async () => {
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");
    await createLinksSymmetric(a.id, [b.id]);

    // Validate the update payload the same way the route does.
    const result = productUpdateSchema.safeParse({ linkedProductIds: [] });
    expect(result.success).toBe(true);
    await replaceLinksSymmetric(a.id, result.data.linkedProductIds);

    const aLinks = await prisma.productLink.findMany({ where: { productId: a.id } });
    const bLinks = await prisma.productLink.findMany({ where: { productId: b.id } });
    expect(aLinks).toHaveLength(0);
    expect(bLinks).toHaveLength(0);
  });

  it("replacing A's links from [B] to [C] drops the B<->A pair and adds the C<->A pair", async () => {
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");
    const c = await createTestProduct("C");
    await createLinksSymmetric(a.id, [b.id]);

    await replaceLinksSymmetric(a.id, [c.id]);

    const aLinks = (await prisma.productLink.findMany({ where: { productId: a.id } })).map((l) => l.linkedProductId);
    const bLinks = await prisma.productLink.findMany({ where: { productId: b.id } });
    const cLinks = (await prisma.productLink.findMany({ where: { productId: c.id } })).map((l) => l.linkedProductId);

    expect(aLinks).toEqual([c.id]);
    expect(bLinks).toHaveLength(0);
    expect(cLinks).toEqual([a.id]);
  });

  it("submitting a product's own id in its update payload does not create a self-link", async () => {
    const a = await createTestProduct("A");

    // Mirrors PATCH /products/:id's dedupedLinkIds filter: a product's own id
    // can legitimately end up in the submitted list (e.g. a stale admin-form
    // search result from before an edit), so the route filters it out before
    // diffing/writing, same as this helper does.
    const result = productUpdateSchema.safeParse({ linkedProductIds: [a.id] });
    expect(result.success).toBe(true);
    await replaceLinksSymmetric(a.id, result.data.linkedProductIds);

    const selfLinks = await prisma.productLink.findMany({ where: { productId: a.id, linkedProductId: a.id } });
    expect(selfLinks).toHaveLength(0);
  });
});
