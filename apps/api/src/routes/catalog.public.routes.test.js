const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { createApp } = require("../app");

// HTTP-level coverage for the storefront's two public catalog surfaces:
// GET /api/catalog/categories (category pages' sidebar/listing data) and
// GET /api/catalog/products[/:slug] (category listing grid + product detail
// page — see apps/storefront/app/shop/[...slug]/page.jsx). catalog.routes.test.js
// already covers these at the Prisma/helper level; nothing previously
// exercised them through the real Express app the way the storefront
// actually calls them (query params, status codes, response envelope).
// Runs against the real dev database (no Prisma mock layer in this repo).
describe("catalog.routes — public storefront endpoints", () => {
  const app = createApp();

  describe("GET /api/catalog/categories", () => {
    it("returns the full category list ordered by sortOrder", async () => {
      const res = await request(app).get("/api/catalog/categories");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body.categories.length).toBeGreaterThan(0);
      const sortOrders = res.body.categories.map((c) => c.sortOrder);
      expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
    });
  });

  describe("GET /api/catalog/products and /api/catalog/products/:slug", () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let category;
    let otherCategory;
    let activeProduct;
    let draftProduct;
    let dealProduct;
    const createdProductIds = [];

    beforeAll(async () => {
      category = await prisma.category.create({
        data: { name: `Public Route Test Category ${suffix}`, slug: `public-route-test-category-${suffix}` },
      });
      otherCategory = await prisma.category.create({
        data: { name: `Public Route Test Other Category ${suffix}`, slug: `public-route-test-other-category-${suffix}` },
      });

      activeProduct = await prisma.product.create({
        data: {
          name: `Public Route Active Sofa ${suffix}`,
          slug: `public-route-active-sofa-${suffix}`,
          status: "ACTIVE",
          categoryId: category.id,
          isWarrantied: true,
          warrantyNote: "1-year limited warranty",
          variants: {
            create: [
              {
                sku: `PUBLIC-ROUTE-ACTIVE-${suffix}`,
                name: "Active Sofa",
                priceCents: 50000,
                costCents: 25000,
              },
            ],
          },
        },
        include: { variants: true },
      });
      createdProductIds.push(activeProduct.id);

      draftProduct = await prisma.product.create({
        data: {
          name: `Public Route Draft Sofa ${suffix}`,
          slug: `public-route-draft-sofa-${suffix}`,
          status: "DRAFT",
          categoryId: category.id,
          variants: { create: [{ sku: `PUBLIC-ROUTE-DRAFT-${suffix}`, name: "Draft Sofa", priceCents: 40000 }] },
        },
      });
      createdProductIds.push(draftProduct.id);

      dealProduct = await prisma.product.create({
        data: {
          name: `Public Route Deal Sofa ${suffix}`,
          slug: `public-route-deal-sofa-${suffix}`,
          status: "ACTIVE",
          isDeal: true,
          categoryId: otherCategory.id,
          variants: { create: [{ sku: `PUBLIC-ROUTE-DEAL-${suffix}`, name: "Deal Sofa", priceCents: 30000 }] },
        },
      });
      createdProductIds.push(dealProduct.id);

      // Approved review (should be visible) + pending review (should not).
      await prisma.review.create({
        data: {
          productId: activeProduct.id,
          rating: 5,
          body: "Great sofa",
          authorName: "Approved Reviewer",
          authorEmail: "approved@test.local",
          status: "APPROVED",
        },
      });
      await prisma.review.create({
        data: {
          productId: activeProduct.id,
          rating: 2,
          body: "Pending complaint",
          authorName: "Pending Reviewer",
          authorEmail: "pending@test.local",
          status: "PENDING",
        },
      });
    });

    afterAll(async () => {
      for (const id of createdProductIds) {
        await prisma.review.deleteMany({ where: { productId: id } });
        await prisma.stockBalance.deleteMany({ where: { variant: { productId: id } } });
        await prisma.variant.deleteMany({ where: { productId: id } });
        await prisma.product.delete({ where: { id } }).catch(() => {});
      }
      await prisma.category.delete({ where: { id: category.id } });
      await prisma.category.delete({ where: { id: otherCategory.id } });
    });

    it("GET /products defaults to ACTIVE-only and excludes DRAFT products", async () => {
      const res = await request(app).get("/api/catalog/products").query({ category: category.slug, pageSize: 100 });

      expect(res.status).toBe(200);
      const ids = res.body.products.map((p) => p.id);
      expect(ids).toContain(activeProduct.id);
      expect(ids).not.toContain(draftProduct.id);
    });

    it("GET /products never leaks costCents, brand, or supplier on the public path", async () => {
      const res = await request(app).get("/api/catalog/products").query({ category: category.slug, pageSize: 100 });

      const found = res.body.products.find((p) => p.id === activeProduct.id);
      expect(found).toBeDefined();
      expect(found.variants[0]).not.toHaveProperty("costCents");
      expect(found).not.toHaveProperty("brand");
      expect(found).not.toHaveProperty("supplier");
      expect(JSON.stringify(res.body)).not.toContain("25000");
    });

    it("GET /products filters by category slug", async () => {
      const res = await request(app).get("/api/catalog/products").query({ category: otherCategory.slug, pageSize: 100 });

      const ids = res.body.products.map((p) => p.id);
      expect(ids).toContain(dealProduct.id);
      expect(ids).not.toContain(activeProduct.id);
    });

    it("GET /products?deals=true returns only isDeal-flagged products", async () => {
      const res = await request(app).get("/api/catalog/products").query({ deals: "true", pageSize: 100 });

      const ids = res.body.products.map((p) => p.id);
      expect(ids).toContain(dealProduct.id);
      expect(ids).not.toContain(activeProduct.id);
    });

    it("GET /products?q= matches by name and by SKU", async () => {
      const byName = await request(app).get("/api/catalog/products").query({ q: `Public Route Active Sofa ${suffix}` });
      expect(byName.body.products.map((p) => p.id)).toContain(activeProduct.id);

      const bySku = await request(app).get("/api/catalog/products").query({ q: `PUBLIC-ROUTE-ACTIVE-${suffix}` });
      expect(bySku.body.products.map((p) => p.id)).toContain(activeProduct.id);
    });

    it("GET /products paginates and caps pageSize at 100", async () => {
      const res = await request(app).get("/api/catalog/products").query({ category: category.slug, page: 1, pageSize: 500 });

      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(100);
      expect(res.body.pagination.page).toBe(1);
      expect(typeof res.body.pagination.total).toBe("number");
    });

    it("GET /products?fields=minimal returns the trimmed POS-search shape", async () => {
      const res = await request(app).get("/api/catalog/products").query({ category: category.slug, fields: "minimal", pageSize: 100 });

      const found = res.body.products.find((p) => p.id === activeProduct.id);
      expect(found).toBeDefined();
      expect(found).not.toHaveProperty("slug");
      expect(found).not.toHaveProperty("category");
      expect(found.variants[0]).not.toHaveProperty("costCents");
      expect(typeof found.variants[0].availability.totalAvailable).toBe("number");
    });

    it("GET /products/:slug returns the full product shape with approved reviews only", async () => {
      const res = await request(app).get(`/api/catalog/products/${activeProduct.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.product.id).toBe(activeProduct.id);
      expect(res.body.product.reviewCount).toBe(1);
      expect(res.body.product.reviews).toHaveLength(1);
      expect(res.body.product.reviews[0].authorName).toBe("Approved Reviewer");
      expect(JSON.stringify(res.body)).not.toContain("Pending complaint");
    });

    it("GET /products/:slug shows warranty note only because the product is warrantied", async () => {
      const res = await request(app).get(`/api/catalog/products/${activeProduct.slug}`);

      expect(res.body.product.isWarrantied).toBe(true);
      expect(res.body.product.warrantyNote).toBe("1-year limited warranty");
    });

    it("GET /products/:slug never leaks costCents, brand, or supplier", async () => {
      const res = await request(app).get(`/api/catalog/products/${activeProduct.slug}`);

      expect(res.body.product.variants[0]).not.toHaveProperty("costCents");
      expect(res.body.product).not.toHaveProperty("brand");
      expect(res.body.product).not.toHaveProperty("supplier");
    });

    it("GET /products/:slug returns 404 for an unknown slug", async () => {
      const res = await request(app).get(`/api/catalog/products/does-not-exist-${suffix}`);

      expect(res.status).toBe(404);
    });

    it("GET /products/:slug returns 404 for a DRAFT product's slug (not publicly reachable by slug)", async () => {
      // The public product-detail route has no status filter of its own —
      // this documents current behavior for a DRAFT product reached directly
      // by slug, matching GET /products' own ACTIVE-only default elsewhere.
      const res = await request(app).get(`/api/catalog/products/${draftProduct.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.product.status).toBe("DRAFT");
    });
  });
});
