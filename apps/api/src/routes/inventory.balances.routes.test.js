const bcrypt = require("bcryptjs");
const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { LOW_STOCK_THRESHOLD } = require("@big-eds/config");
const { createApp } = require("../app");
const { signAccessToken, ACCESS_COOKIE } = require("../lib/tokens");

// HTTP-level coverage for GET /inventory/balances after it moved the
// lowStockOnly filter from a JS .filter() over the entire StockBalance table
// into a raw-SQL GREATEST(onHand - reserved - quarantined, 0) <= threshold
// comparison (same approach dashboard.routes.js's low-stock tile already
// used) — this is a regression test for both the low-stock filter itself and
// the unescaped-% search bug class (see pos.service.js/posReturns.service.js
// for the same class of fix). Runs against the real dev database (no Prisma
// mock layer in this repo).
describe("inventory.routes — GET /inventory/balances", () => {
  const app = createApp();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let managerCookie;
  let category;
  let product;
  let location;
  let lowStockVariant; // onHand === LOW_STOCK_THRESHOLD, 0 reserved -> available === threshold
  let healthyVariant; // onHand way above threshold

  beforeAll(async () => {
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "MANAGER" } });
    const passwordHash = await bcrypt.hash("TestPassword123!", 10);
    const managerUser = await prisma.user.create({
      data: {
        email: `inventory-balances-manager-${suffix}@example.com`,
        passwordHash,
        firstName: "Inventory",
        lastName: "Manager",
        isActive: true,
        roles: { create: { roleId: managerRole.id } },
      },
    });
    managerCookie = `${ACCESS_COOKIE}=${signAccessToken({ sub: managerUser.id })}`;

    location = await prisma.location.create({ data: { name: `Inventory Balances Test Location ${suffix}`, type: "WAREHOUSE" } });
    category = await prisma.category.create({
      data: { name: "Inventory Balances Test Category", slug: `inventory-balances-test-category-${suffix}` },
    });
    product = await prisma.product.create({
      data: { name: "Inventory Balances Test Sofa 100%OFF", slug: `inventory-balances-test-sofa-${suffix}`, status: "ACTIVE", categoryId: category.id },
    });
    lowStockVariant = await prisma.variant.create({
      data: { productId: product.id, sku: `INV-BAL-LOW-${suffix}`, name: "Low Stock", priceCents: 10000 },
    });
    healthyVariant = await prisma.variant.create({
      data: { productId: product.id, sku: `INV-BAL-HEALTHY-${suffix}`, name: "Healthy Stock", priceCents: 10000 },
    });
    await prisma.stockBalance.createMany({
      data: [
        { variantId: lowStockVariant.id, locationId: location.id, onHand: LOW_STOCK_THRESHOLD, reserved: 0, quarantined: 0 },
        { variantId: healthyVariant.id, locationId: location.id, onHand: LOW_STOCK_THRESHOLD + 50, reserved: 0, quarantined: 0 },
      ],
    });
  });

  afterAll(async () => {
    const variantIds = [lowStockVariant.id, healthyVariant.id];
    await prisma.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.stockBalance.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.variant.deleteMany({ where: { id: { in: variantIds } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.location.delete({ where: { id: location.id } });
  });

  it("returns both rows when lowStockOnly is not set", async () => {
    const res = await request(app)
      .get(`/api/inventory/balances?q=${encodeURIComponent(suffix)}`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    const skus = res.body.balances.map((b) => b.sku);
    expect(skus).toContain(lowStockVariant.sku);
    expect(skus).toContain(healthyVariant.sku);
  });

  it("lowStockOnly=true filters to only the row at or below the threshold, computed in SQL", async () => {
    const res = await request(app)
      .get(`/api/inventory/balances?lowStockOnly=true&q=${encodeURIComponent(suffix)}`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    const skus = res.body.balances.map((b) => b.sku);
    expect(skus).toContain(lowStockVariant.sku);
    expect(skus).not.toContain(healthyVariant.sku);

    const row = res.body.balances.find((b) => b.sku === lowStockVariant.sku);
    expect(row.availableToSell).toBe(LOW_STOCK_THRESHOLD);
    expect(typeof row.onHand).toBe("number");
    expect(typeof row.availableToSell).toBe("number");
  });

  it("a literal % or _ in q is treated literally, not as a SQL wildcard", async () => {
    // Product name contains a literal "100%OFF" — an unescaped "%" query
    // would match broadly (every row in the table, since % means "anything"
    // in SQL LIKE/ILIKE); escaped, it should match only this exact product.
    const res = await request(app).get("/api/inventory/balances?q=100%25OFF").set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    const skus = res.body.balances.map((b) => b.sku);
    expect(skus).toContain(lowStockVariant.sku);
    expect(skus).toContain(healthyVariant.sku);
    expect(res.body.balances.length).toBe(2);
  });

  it("still returns dates as real ISO date strings (JSON-serialized from a real Date, not a raw SQL timestamp object)", async () => {
    const res = await request(app)
      .get(`/api/inventory/balances?q=${encodeURIComponent(suffix)}`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    for (const row of res.body.balances) {
      expect(() => new Date(row.updatedAt).toISOString()).not.toThrow();
      expect(Number.isNaN(new Date(row.updatedAt).getTime())).toBe(false);
    }
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/inventory/balances");
    expect(res.status).toBe(401);
  });
});
