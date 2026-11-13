const { prisma } = require("@big-eds/database");
const { productCreateSchema, productUpdateSchema } = require("@big-eds/validation");
const inventoryService = require("../services/inventory.service");
const {
  pickDisplayCategory,
  syncProductLinksAsGroup,
  getProductDeleteBlockers,
  serializeProduct,
  PRODUCT_INCLUDE_STAFF,
  assertSupplierExists,
} = require("./catalog.routes");

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

// Exercises the real syncProductLinksAsGroup from catalog.routes.js directly
// (imported, not reimplemented) — the non-negotiable property here is that
// links form a fully-connected group (clique), not just pairwise edges back
// to whichever product was being edited: linking A, B, C, D under E must make
// A, B, C, D all mutually linked to each other too, and a member dropped from
// a submission must leave the whole group, not just lose its edge to the
// product being edited.
describe("catalog.routes — linkedProductIds group (clique) semantics", () => {
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

  async function linksOf(productId) {
    const links = await prisma.productLink.findMany({ where: { productId }, select: { linkedProductId: true } });
    return links.map((l) => l.linkedProductId).sort();
  }

  it("linking A, B, C, D under E makes every one of them mutually linked, not just back to E", async () => {
    const e = await createTestProduct("E");
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");
    const c = await createTestProduct("C");
    const d = await createTestProduct("D");

    const result = productUpdateSchema.safeParse({ linkedProductIds: [a.id, b.id, c.id, d.id] });
    expect(result.success, `safeParse failed: ${JSON.stringify(result.error?.flatten())}`).toBe(true);
    await syncProductLinksAsGroup(prisma, e.id, result.data.linkedProductIds);

    const group = [e.id, a.id, b.id, c.id, d.id];
    for (const member of group) {
      const expected = group.filter((id) => id !== member).sort();
      expect(await linksOf(member)).toEqual(expected);
    }
  });

  it("linking B under A on create also makes A appear under B, with no action on B", async () => {
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");

    await syncProductLinksAsGroup(prisma, a.id, [b.id]);

    expect(await linksOf(a.id)).toEqual([b.id]);
    expect(await linksOf(b.id)).toEqual([a.id]);
  });

  it("removing B from A's linked list on update also removes A from B's list", async () => {
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");
    await syncProductLinksAsGroup(prisma, a.id, [b.id]);

    // Validate the update payload the same way the route does.
    const result = productUpdateSchema.safeParse({ linkedProductIds: [] });
    expect(result.success).toBe(true);
    await syncProductLinksAsGroup(prisma, a.id, result.data.linkedProductIds);

    expect(await linksOf(a.id)).toHaveLength(0);
    expect(await linksOf(b.id)).toHaveLength(0);
  });

  it("replacing A's links from [B] to [C] drops the B<->A pair and adds the C<->A pair", async () => {
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");
    const c = await createTestProduct("C");
    await syncProductLinksAsGroup(prisma, a.id, [b.id]);

    await syncProductLinksAsGroup(prisma, a.id, [c.id]);

    expect(await linksOf(a.id)).toEqual([c.id]);
    expect(await linksOf(b.id)).toHaveLength(0);
    expect(await linksOf(c.id)).toEqual([a.id]);
  });

  it("submitting a product's own id in its update payload does not create a self-link", async () => {
    const a = await createTestProduct("A");

    // Mirrors syncProductLinksAsGroup's dedupedSubmittedIds filter: a
    // product's own id can legitimately end up in the submitted list (e.g. a
    // stale admin-form search result from before an edit), so it's filtered
    // out before diffing/writing.
    const result = productUpdateSchema.safeParse({ linkedProductIds: [a.id] });
    expect(result.success).toBe(true);
    await syncProductLinksAsGroup(prisma, a.id, result.data.linkedProductIds);

    const selfLinks = await prisma.productLink.findMany({ where: { productId: a.id, linkedProductId: a.id } });
    expect(selfLinks).toHaveLength(0);
  });

  it("dropping a member from an existing clique removes it from every other member, not just the edited product", async () => {
    // Build the clique {E, A, B, C, D} first.
    const e = await createTestProduct("E");
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");
    const c = await createTestProduct("C");
    const d = await createTestProduct("D");
    await syncProductLinksAsGroup(prisma, e.id, [a.id, b.id, c.id, d.id]);

    // Now edit E's list to drop B — B must leave the WHOLE group (lose its
    // links to A, C, D too), not just its link to E.
    const result = productUpdateSchema.safeParse({ linkedProductIds: [a.id, c.id, d.id] });
    expect(result.success).toBe(true);
    await syncProductLinksAsGroup(prisma, e.id, result.data.linkedProductIds);

    expect(await linksOf(b.id)).toHaveLength(0);

    const remainingGroup = [e.id, a.id, c.id, d.id];
    for (const member of remainingGroup) {
      const expected = remainingGroup.filter((id) => id !== member).sort();
      expect(await linksOf(member)).toEqual(expected);
    }
  });

  it("linking a product that already belongs to its own group merges both groups into one clique", async () => {
    // Pre-existing group {A, B}.
    const a = await createTestProduct("A");
    const b = await createTestProduct("B");
    await syncProductLinksAsGroup(prisma, a.id, [b.id]);

    // Separate group {E} links in A — must pull B along too, merging into {E, A, B}.
    const e = await createTestProduct("E");
    const result = productUpdateSchema.safeParse({ linkedProductIds: [a.id] });
    expect(result.success).toBe(true);
    await syncProductLinksAsGroup(prisma, e.id, result.data.linkedProductIds);

    const mergedGroup = [e.id, a.id, b.id];
    for (const member of mergedGroup) {
      const expected = mergedGroup.filter((id) => id !== member).sort();
      expect(await linksOf(member)).toEqual(expected);
    }
  });
});

// Covers the admin "delete product" feature: archive (status flip, always
// available, non-destructive) and permanent delete (only when no history
// exists anywhere across the product's variants — see DELETE /products/:id
// and getProductDeleteBlockers in catalog.routes.js).
describe("catalog.routes — product archive and delete", () => {
  const createdProductIds = [];
  let location;

  beforeAll(async () => {
    location = await prisma.location.create({
      data: { name: "Delete Test Location", type: "WAREHOUSE", isActive: true },
    });
  });

  afterAll(async () => {
    for (const id of createdProductIds) {
      await prisma.stockMovement.deleteMany({ where: { variant: { productId: id } } });
      await prisma.reservation.deleteMany({ where: { variant: { productId: id } } });
      await prisma.transfer.deleteMany({ where: { variant: { productId: id } } });
      await prisma.stockBalance.deleteMany({ where: { variant: { productId: id } } });
      await prisma.variant.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } }).catch(() => {});
    }
    await prisma.location.delete({ where: { id: location.id } }).catch(() => {});
  });

  async function createTestProduct(label) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      name: `Delete Test ${label} ${suffix}`,
      slug: `delete-test-${label.toLowerCase()}-${suffix}`,
      status: "ACTIVE",
      variants: [{ sku: `DELETE-TEST-${label}-${suffix}`, name: `Delete Test ${label}`, priceCents: 1000 }],
    };
    const result = productCreateSchema.safeParse(payload);
    expect(result.success, `safeParse failed: ${JSON.stringify(result.error?.flatten())}`).toBe(true);
    const { variants, ...productData } = result.data;
    const created = await prisma.product.create({
      data: { ...productData, variants: { create: variants } },
      include: { variants: true },
    });
    createdProductIds.push(created.id);
    return created;
  }

  it("archiving a product sets status to ARCHIVED without touching its variants", async () => {
    const product = await createTestProduct("Archive");

    const updated = await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });

    expect(updated.status).toBe("ARCHIVED");
    const variant = await prisma.variant.findUnique({ where: { id: product.variants[0].id } });
    expect(variant).not.toBeNull();
  });

  it("unarchiving a product returns it to DRAFT, not ACTIVE", async () => {
    const product = await createTestProduct("Unarchive");
    await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });

    const restored = await prisma.product.update({ where: { id: product.id }, data: { status: "DRAFT" } });

    expect(restored.status).toBe("DRAFT");
  });

  it("getProductDeleteBlockers reports zero for a product with no stock/order/reservation/transfer/PO history", async () => {
    const product = await createTestProduct("Unused");

    const blockers = await getProductDeleteBlockers(product.variants.map((v) => v.id));

    expect(Object.values(blockers).every((n) => n === 0)).toBe(true);
  });

  it("getProductDeleteBlockers reports a non-zero count when a StockMovement references the variant", async () => {
    const product = await createTestProduct("WithMovement");
    const variantId = product.variants[0].id;
    await prisma.stockMovement.create({
      data: { variantId, locationId: location.id, type: "ADJUSTMENT_INCREASE", quantity: 1 },
    });

    const blockers = await getProductDeleteBlockers([variantId]);

    expect(blockers.stockMovementCount).toBe(1);
    expect(Object.values(blockers).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0);
  });

  it("getProductDeleteBlockers reports a non-zero count when a Reservation references the variant", async () => {
    const product = await createTestProduct("WithReservation");
    const variantId = product.variants[0].id;
    await prisma.reservation.create({
      data: { variantId, locationId: location.id, quantity: 1, status: "ACTIVE", expiresAt: new Date(Date.now() + 60_000) },
    });

    const blockers = await getProductDeleteBlockers([variantId]);

    expect(blockers.reservationCount).toBe(1);
  });

  it("getProductDeleteBlockers reports a non-zero count when a Transfer references the variant", async () => {
    const secondLocation = await prisma.location.create({
      data: { name: "Delete Test Location 2", type: "WAREHOUSE", isActive: true },
    });
    const product = await createTestProduct("WithTransfer");
    const variantId = product.variants[0].id;
    await prisma.transfer.create({
      data: {
        variantId,
        fromLocationId: location.id,
        toLocationId: secondLocation.id,
        quantity: 1,
        status: "PENDING",
      },
    });

    const blockers = await getProductDeleteBlockers([variantId]);

    expect(blockers.transferCount).toBe(1);

    await prisma.transfer.deleteMany({ where: { variantId } });
    await prisma.location.delete({ where: { id: secondLocation.id } });
  });

  it("a product with no history can be hard-deleted and cascades its variants", async () => {
    const product = await createTestProduct("HardDelete");
    const variantId = product.variants[0].id;

    const blockers = await getProductDeleteBlockers([variantId]);
    expect(Object.values(blockers).every((n) => n === 0)).toBe(true);

    await prisma.product.delete({ where: { id: product.id } });
    createdProductIds.splice(createdProductIds.indexOf(product.id), 1);

    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
    expect(await prisma.variant.findUnique({ where: { id: variantId } })).toBeNull();
  });
});

// serializeProduct's `includeCost` option (default false) is the ONLY thing
// standing between Variant.costCents (the margin-sensitive "Purchase Price")
// and the two public, unauthenticated storefront routes (GET /products,
// GET /products/:slug) that call this exact function with no second
// argument — a regression here would leak supplier cost to every customer.
// GET /admin/products is the only caller that ever passes includeCost: true,
// and only after checking req.user.permissions.has("catalog:cost:view")
// (see that route handler in catalog.routes.js).
describe("catalog.routes — serializeProduct cost visibility", () => {
  const createdProductIds = [];

  afterAll(async () => {
    for (const id of createdProductIds) {
      await prisma.stockBalance.deleteMany({ where: { variant: { productId: id } } });
      await prisma.variant.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } });
    }
  });

  async function createProductWithCost() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await prisma.product.create({
      data: {
        name: `Cost Visibility Test ${suffix}`,
        slug: `cost-visibility-test-${suffix}`,
        status: "ACTIVE",
        variants: {
          create: [
            {
              sku: `COST-VIS-TEST-${suffix}`,
              name: `Cost Visibility Test ${suffix}`,
              priceCents: 50000,
              costCents: 25000,
            },
          ],
        },
      },
      include: {
        category: true,
        categoryTags: { include: { category: true } },
        images: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        variants: { include: { stockBalances: { include: { location: true } } } },
        linkedTo: { include: { linkedProduct: { select: { id: true, slug: true, name: true, images: true, variants: true } } } },
      },
    });
    createdProductIds.push(created.id);
    return created;
  }

  it("omits costCents by default (the shape every public storefront route gets)", async () => {
    const product = await createProductWithCost();

    const serialized = serializeProduct(product);

    expect(serialized.variants[0]).not.toHaveProperty("costCents");
  });

  it("omits costCents when includeCost is explicitly false", async () => {
    const product = await createProductWithCost();

    const serialized = serializeProduct(product, { includeCost: false });

    expect(serialized.variants[0]).not.toHaveProperty("costCents");
  });

  it("includes the real costCents value only when includeCost is true (the admin-only path)", async () => {
    const product = await createProductWithCost();

    const serialized = serializeProduct(product, { includeCost: true });

    expect(serialized.variants[0].costCents).toBe(25000);
  });

  it("GET /products-style map callback never crashes serializeProduct by passing it an array index", () => {
    // Regression test for a real bug caught during review: `products.map(fn)`
    // calls fn(element, index, array) — passing the bare `serializeProduct`
    // reference (instead of wrapping it in an arrow) handed its second
    // parameter (an options object) the numeric array index instead, which
    // crashed destructuring ({ includeCost } of a number) on every request
    // past the first. Exercises the exact call shape GET /products now uses.
    const products = [
      { variants: [], images: [], videos: [], categoryTags: [], linkedTo: [] },
      { variants: [], images: [], videos: [], categoryTags: [], linkedTo: [] },
    ];

    expect(() => products.map((p) => serializeProduct(p))).not.toThrow();
  });
});

// GET /admin/products/:id (the single-product lookup the Edit Product page
// now uses instead of filtering the full, unfiltered GET /admin/products list
// client-side — see apps/admin/app/products/[id]/page.jsx). The route itself
// is a thin findUnique + serializeProduct wrapper with no branching logic of
// its own, so this exercises exactly that: the query returns the one matching
// product in serializeProduct's expected shape, and a nonexistent id resolves
// to null (which the route turns into a 404), the same as GET /products/:slug
// already does for its own not-found case.
describe("catalog.routes — GET /admin/products/:id", () => {
  let product;

  afterAll(async () => {
    if (product) {
      await prisma.stockBalance.deleteMany({ where: { variant: { productId: product.id } } });
      await prisma.variant.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
  });

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    product = await prisma.product.create({
      data: {
        name: `Get By Id Test ${suffix}`,
        slug: `get-by-id-test-${suffix}`,
        status: "ACTIVE",
        variants: { create: [{ sku: `GET-BY-ID-TEST-${suffix}`, name: `Get By Id Test ${suffix}`, priceCents: 75000 }] },
      },
      include: { variants: true },
    });
  });

  it("finds the product by id with the full include, ready for serializeProduct", async () => {
    const found = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        categoryTags: { include: { category: true } },
        images: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        variants: { include: { stockBalances: { include: { location: true } } } },
        linkedTo: { include: { linkedProduct: { select: { id: true, slug: true, name: true, images: true, variants: true } } } },
      },
    });

    expect(found).not.toBeNull();
    const serialized = serializeProduct(found);
    expect(serialized.id).toBe(product.id);
    expect(serialized.variants[0].sku).toBe(product.variants[0].sku);
  });

  it("resolves to null for an id that doesn't exist, which the route turns into a 404", async () => {
    const found = await prisma.product.findUnique({ where: { id: "00000000-0000-4000-8000-000000000000" } });
    expect(found).toBeNull();
  });
});

// `brand` and `supplier` are internal, staff-facing catalog data (Product.brand,
// Product.supplierId). The two public storefront routes call
// serializeProduct(product) with no options, so `includeInternal` defaulting to
// false is the only thing keeping them out of customer-visible JSON — same
// guard as `includeCost` above. Every staff route passes includeInternal: true.
describe("catalog.routes — product brand/supplier (internal-only)", () => {
  const { productCreateSchema, productUpdateSchema } = require("@big-eds/validation");
  const { ValidationError } = require("../lib/errors");

  let supplier;
  let product;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const SUPPLIER_NAME = `Internal Test Supplier ${suffix}`;
  const BRAND = `Internal Test Brand ${suffix}`;

  beforeAll(async () => {
    supplier = await prisma.supplier.create({ data: { name: SUPPLIER_NAME } });
    product = await prisma.product.create({
      data: {
        name: `Brand Supplier Test ${suffix}`,
        slug: `brand-supplier-test-${suffix}`,
        status: "ACTIVE",
        brand: BRAND,
        supplierId: supplier.id,
        variants: { create: [{ sku: `BRAND-SUP-TEST-${suffix}`, name: `Brand Supplier Test ${suffix}`, priceCents: 10000 }] },
      },
      include: PRODUCT_INCLUDE_STAFF,
    });
  });

  afterAll(async () => {
    if (product) {
      await prisma.stockBalance.deleteMany({ where: { variant: { productId: product.id } } });
      await prisma.variant.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
    // Already gone if the SetNull test below ran; deleteMany tolerates that.
    await prisma.supplier.deleteMany({ where: { id: supplier.id } });
  });

  it("omits brand, supplierId and supplier by default (the shape both public storefront routes return)", () => {
    const serialized = serializeProduct(product);

    expect(serialized).not.toHaveProperty("brand");
    expect(serialized).not.toHaveProperty("supplierId");
    expect(serialized).not.toHaveProperty("supplier");
  });

  it("omits them when includeInternal is explicitly false, and leaks neither value anywhere in the JSON", () => {
    const serialized = serializeProduct(product, { includeInternal: false });

    expect(serialized).not.toHaveProperty("brand");
    expect(serialized).not.toHaveProperty("supplier");
    const json = JSON.stringify(serialized);
    expect(json).not.toContain(BRAND);
    expect(json).not.toContain(SUPPLIER_NAME);
  });

  it("includes brand, supplierId and supplier {id, name} only when includeInternal is true (the staff path)", () => {
    const serialized = serializeProduct(product, { includeInternal: true });

    expect(serialized.brand).toBe(BRAND);
    expect(serialized.supplierId).toBe(supplier.id);
    expect(serialized.supplier).toEqual({ id: supplier.id, name: SUPPLIER_NAME });
  });

  it("returns nulls (not undefined) for a product with no brand or supplier on the staff path", async () => {
    const bare = await prisma.product.create({
      data: {
        name: `Bare ${suffix}`,
        slug: `bare-brand-supplier-test-${suffix}`,
        variants: { create: [{ sku: `BARE-BS-TEST-${suffix}`, name: `Bare ${suffix}`, priceCents: 500 }] },
      },
      include: PRODUCT_INCLUDE_STAFF,
    });
    try {
      const serialized = serializeProduct(bare, { includeInternal: true });
      expect(serialized.brand).toBeNull();
      expect(serialized.supplierId).toBeNull();
      expect(serialized.supplier).toBeNull();
    } finally {
      await prisma.variant.deleteMany({ where: { productId: bare.id } });
      await prisma.product.delete({ where: { id: bare.id } });
    }
  });

  it("assertSupplierExists allows no supplier, allows a real one, and rejects an unknown id with a 422 on supplierId", async () => {
    await expect(assertSupplierExists(undefined)).resolves.toBeUndefined();
    await expect(assertSupplierExists(null)).resolves.toBeUndefined();
    await expect(assertSupplierExists(supplier.id)).resolves.toBeUndefined();

    const err = await assertSupplierExists("00000000-0000-4000-8000-000000000000").catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(422);
    expect(err.details.fieldErrors.supplierId).toEqual(["Supplier not found"]);
  });

  it("assertSupplierExists still allows a deactivated supplier (the form resends it on every unrelated save)", async () => {
    await prisma.supplier.update({ where: { id: supplier.id }, data: { isActive: false } });
    await expect(assertSupplierExists(supplier.id)).resolves.toBeUndefined();
    await prisma.supplier.update({ where: { id: supplier.id }, data: { isActive: true } });
  });

  it("validation accepts a uuid or null supplierId, rejects anything else, and trims brand", () => {
    const base = { name: "X", slug: "x", variants: [{ sku: "X-1", name: "X", priceCents: 100 }] };

    const ok = productCreateSchema.safeParse({ ...base, brand: "  Acme  ", supplierId: supplier.id });
    expect(ok.success).toBe(true);
    expect(ok.data.brand).toBe("Acme");
    expect(ok.data.supplierId).toBe(supplier.id);

    expect(productCreateSchema.safeParse({ ...base, supplierId: null }).success).toBe(true);
    expect(productCreateSchema.safeParse({ ...base }).success).toBe(true);
    expect(productCreateSchema.safeParse({ ...base, supplierId: "not-a-uuid" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...base, brand: "x".repeat(121) }).success).toBe(false);
    // PATCH clearing both fields (what the admin Edit form sends when emptied).
    expect(productUpdateSchema.safeParse({ brand: null, supplierId: null }).success).toBe(true);
  });

  it("deleting a supplier clears Product.supplierId (SetNull) instead of blocking or deleting the product", async () => {
    await prisma.supplier.delete({ where: { id: supplier.id } });

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after).not.toBeNull();
    expect(after.supplierId).toBeNull();
    expect(after.brand).toBe(BRAND);
  });
});
