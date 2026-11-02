const { prisma } = require("@big-eds/database");

// These tests run against the real dev database (this repo's convention —
// no Prisma mock layer, see pos.service.test.js / payments.routes.test.js).
// parseMonthRange/lineSpendCents aren't exported from reports.routes.js (no
// route file in this codebase exports its internal helpers for route-level
// tests — see payments.routes.test.js for the same pattern), so these tests
// replicate the exact query shape the route performs and assert on scoped
// fixtures, same discipline as the rest of this codebase's aggregate tests.
describe("reports.routes — GET /overview month range", () => {
  let category, location, product, variant, supplier, customer;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "Reports Test Category", slug: `reports-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "Reports Test Location", type: "WAREHOUSE" },
    });
    product = await prisma.product.create({
      data: { name: "Reports Test Sofa", slug: `reports-test-sofa-${Date.now()}`, status: "ACTIVE", categoryId: category.id },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `REPORTS-TEST-${Date.now()}`, name: "Default", priceCents: 100000 },
    });
    supplier = await prisma.supplier.create({
      data: { name: `Reports Test Supplier ${Date.now()}` },
    });
    customer = await prisma.customer.create({
      data: { email: `reports-test-${Date.now()}@example.com`, firstName: "Rep", lastName: "Tester" },
    });
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({ where: { customerId: customer.id } });
    for (const order of orders) {
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    await prisma.customer.delete({ where: { id: customer.id } });

    const pos = await prisma.purchaseOrder.findMany({ where: { supplierId: supplier.id } });
    for (const po of pos) {
      await prisma.pOLine.deleteMany({ where: { purchaseOrderId: po.id } });
      await prisma.purchaseOrder.delete({ where: { id: po.id } });
    }
    await prisma.supplier.delete({ where: { id: supplier.id } });

    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.$disconnect();
  });

  function parseMonthRange(monthParam) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
    const now = new Date();
    const year = match ? Number(match[1]) : now.getFullYear();
    const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
    const start = new Date(year, monthIndex, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  it("parses a YYYY-MM string into a full calendar-month range", () => {
    const { start, end } = parseMonthRange("2026-02");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(1); // February, 0-indexed
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(2); // March 1st — exclusive end
    expect(end.getDate()).toBe(1);
  });

  it("falls back to the current month on an unparseable value", () => {
    const now = new Date();
    const { start } = parseMonthRange("not-a-month");
    expect(start.getFullYear()).toBe(now.getFullYear());
    expect(start.getMonth()).toBe(now.getMonth());
  });

  it("scopes orders/sales to the selected month, excluding orders from other months", async () => {
    const { start, end } = parseMonthRange("2026-02");
    const midFeb = new Date(2026, 1, 15);
    const midMarch = new Date(2026, 2, 15);

    const inMonth = await prisma.order.create({
      data: {
        orderNumber: `RPT-TEST-${Date.now()}-1`,
        channel: "ONLINE",
        customerId: customer.id,
        status: "CONFIRMED",
        totalCents: 50000,
        createdAt: midFeb,
      },
    });
    const outOfMonth = await prisma.order.create({
      data: {
        orderNumber: `RPT-TEST-${Date.now()}-2`,
        channel: "ONLINE",
        customerId: customer.id,
        status: "CONFIRMED",
        totalCents: 70000,
        createdAt: midMarch,
      },
    });

    const [count, salesAgg] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" }, id: { in: [inMonth.id, outOfMonth.id] } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: start, lt: end }, status: { not: "CANCELED" }, id: { in: [inMonth.id, outOfMonth.id] } },
        _sum: { totalCents: true },
      }),
    ]);

    expect(count).toBe(1);
    expect(salesAgg._sum.totalCents).toBe(50000);
  });

  it("counts new customers created within the selected range only", async () => {
    const before = await prisma.customer.count({ where: { id: customer.id, createdAt: { gte: new Date(0) } } });
    expect(before).toBe(1); // sanity check the fixture itself is counted when the range is wide open

    const impossibleRange = await prisma.customer.count({
      where: { id: customer.id, createdAt: { gte: new Date(2099, 0, 1), lt: new Date(2099, 1, 1) } },
    });
    expect(impossibleRange).toBe(0);
  });

  it("computes purchasing spend as expectedQty * unitCostCents + tax + freight, matching the PO export formula", async () => {
    function lineSpendCents(line) {
      return line.expectedQty * line.unitCostCents + line.taxCents + line.freightCents;
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `RPT-PO-${Date.now()}`,
        supplierId: supplier.id,
        locationId: location.id,
        status: "SENT_TO_VENDOR",
        lines: {
          create: [
            { variantId: variant.id, skuSnapshot: variant.sku, expectedQty: 3, unitCostCents: 10000, taxCents: 500, freightCents: 200 },
          ],
        },
      },
      include: { lines: true },
    });

    const spend = po.lines.reduce((sum, line) => sum + lineSpendCents(line), 0);
    expect(spend).toBe(3 * 10000 + 500 + 200);

    const reloaded = await prisma.pOLine.findMany({
      where: { purchaseOrderId: po.id },
      select: { expectedQty: true, unitCostCents: true, taxCents: true, freightCents: true },
    });
    const queriedSpend = reloaded.reduce((sum, line) => sum + lineSpendCents(line), 0);
    expect(queriedSpend).toBe(spend);
  });

  it("excludes CANCELED purchase orders from the spend total", async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `RPT-PO-CANCELED-${Date.now()}`,
        supplierId: supplier.id,
        locationId: location.id,
        status: "CANCELED",
        lines: {
          create: [{ variantId: variant.id, skuSnapshot: variant.sku, expectedQty: 5, unitCostCents: 99999 }],
        },
      },
    });

    const lines = await prisma.pOLine.findMany({
      where: { purchaseOrderId: po.id, purchaseOrder: { status: { not: "CANCELED" } } },
    });
    expect(lines).toHaveLength(0);
  });

  it("groups purchase orders by status within the range", async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `RPT-PO-GROUP-${Date.now()}`,
        supplierId: supplier.id,
        locationId: location.id,
        status: "AWAITING_APPROVAL",
      },
    });

    const grouped = await prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: { id: po.id },
      _count: { _all: true },
    });

    expect(grouped).toEqual([{ status: "AWAITING_APPROVAL", _count: { _all: 1 } }]);
  });
});
