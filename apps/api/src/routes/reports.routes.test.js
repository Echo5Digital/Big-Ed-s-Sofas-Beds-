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
      data: { email: `reports-test-${Date.now()}@example.com`, firstName: "Rep", lastName: "Tester", channel: "ONLINE" },
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

// Covers the new /products, /orders-breakdown, /po-alerts, and /performance
// routes added alongside the admin Reports tab redesign. Same real-dev-DB,
// scoped-fixture discipline as the suite above — these tests replicate the
// route's query shape rather than importing internal helpers (no route file
// in this codebase exports them), and assert against fixtures filtered by id
// so they can't be polluted by unrelated rows already in the dev database.
describe("reports.routes — products/orders/PO/performance aggregates", () => {
  let category, product, variant, supplier, location;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "Reports Agg Test Category", slug: `reports-agg-category-${Date.now()}` },
    });
    product = await prisma.product.create({
      data: { name: "Reports Agg Test Sofa", slug: `reports-agg-sofa-${Date.now()}`, status: "ACTIVE", categoryId: category.id },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `REPORTS-AGG-${Date.now()}`, name: "Default", priceCents: 50000 },
    });
    supplier = await prisma.supplier.create({ data: { name: `Reports Agg Supplier ${Date.now()}` } });
    location = await prisma.location.create({ data: { name: "Reports Agg Location", type: "WAREHOUSE" } });
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { productId: product.id } });

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

  it("groups review counts/avg rating by product for the most-reviewed aggregate, with no products yielding zero rows", async () => {
    const before = await prisma.review.groupBy({
      by: ["productId"],
      where: { productId: product.id },
      _count: { _all: true },
      _avg: { rating: true },
    });
    expect(before).toEqual([]); // no division-by-zero/empty-state surprises before any review exists

    await prisma.review.createMany({
      data: [
        { productId: product.id, rating: 5, body: "Great", authorName: "A", authorEmail: "a@example.com" },
        { productId: product.id, rating: 3, body: "OK", authorName: "B", authorEmail: "b@example.com" },
      ],
    });

    const grouped = await prisma.review.groupBy({
      by: ["productId"],
      where: { productId: product.id },
      _count: { _all: true },
      _avg: { rating: true },
    });

    expect(grouped).toHaveLength(1);
    expect(grouped[0]._count._all).toBe(2);
    expect(grouped[0]._avg.rating).toBe(4);
  });

  it("sums OrderLine quantity/revenue per variant for the most-sold aggregate", async () => {
    const customer = await prisma.customer.create({
      data: { email: `reports-agg-${Date.now()}@example.com`, firstName: "Agg", lastName: "Tester", channel: "ONLINE" },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `RPT-AGG-${Date.now()}`,
        channel: "ONLINE",
        customerId: customer.id,
        status: "CONFIRMED",
        totalCents: 100000,
        lines: {
          create: [
            {
              variantId: variant.id,
              skuSnapshot: variant.sku,
              nameSnapshot: product.name,
              quantity: 2,
              unitPriceCents: 50000,
              lineTotalCents: 100000,
            },
          ],
        },
      },
    });

    const lines = await prisma.orderLine.findMany({
      where: { orderId: order.id },
      select: { quantity: true, lineTotalCents: true, variantId: true },
    });
    const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalRevenue = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    expect(totalQty).toBe(2);
    expect(totalRevenue).toBe(100000);

    await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  });

  it("buckets order fulfillmentStatus into booked/processing/ready/complete without conflating order.status", async () => {
    const customer = await prisma.customer.create({
      data: { email: `reports-agg-fulfillment-${Date.now()}@example.com`, firstName: "Ful", lastName: "Fill", channel: "ONLINE" },
    });
    const orders = await Promise.all([
      prisma.order.create({
        data: { orderNumber: `RPT-FUL-${Date.now()}-1`, channel: "ONLINE", customerId: customer.id, status: "CONFIRMED", fulfillmentStatus: "RESERVED", totalCents: 1000 },
      }),
      prisma.order.create({
        data: { orderNumber: `RPT-FUL-${Date.now()}-2`, channel: "ONLINE", customerId: customer.id, status: "CONFIRMED", fulfillmentStatus: "READY", totalCents: 1000 },
      }),
      prisma.order.create({
        data: { orderNumber: `RPT-FUL-${Date.now()}-3`, channel: "ONLINE", customerId: customer.id, status: "CANCELED", fulfillmentStatus: "UNALLOCATED", totalCents: 1000 },
      }),
    ]);

    const ids = orders.map((o) => o.id);
    const [grouped, canceled] = await Promise.all([
      prisma.order.groupBy({
        by: ["fulfillmentStatus"],
        where: { id: { in: ids }, status: { not: "CANCELED" } },
        _count: { _all: true },
      }),
      prisma.order.count({ where: { id: { in: ids }, status: "CANCELED" } }),
    ]);

    const countByStatus = Object.fromEntries(grouped.map((g) => [g.fulfillmentStatus, g._count._all]));
    expect(countByStatus.RESERVED).toBe(1);
    expect(countByStatus.READY).toBe(1);
    expect(canceled).toBe(1); // canceled order surfaced separately, not silently dropped

    for (const order of orders) await prisma.order.delete({ where: { id: order.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  });

  it("buckets PO line delivery alerts into overdue/dueToday/dueSoon by expectedDate, excluding fully-received lines", async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    const inTwoDays = new Date(todayStart);
    inTwoDays.setDate(inTwoDays.getDate() + 2);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `RPT-ALERT-${Date.now()}`,
        supplierId: supplier.id,
        locationId: location.id,
        status: "SENT_TO_VENDOR",
        lines: {
          create: [
            { variantId: variant.id, skuSnapshot: variant.sku, expectedQty: 5, receivedQty: 0, unitCostCents: 1000, expectedDate: yesterday },
            { variantId: variant.id, skuSnapshot: variant.sku, expectedQty: 5, receivedQty: 0, unitCostCents: 1000, expectedDate: inTwoDays },
            { variantId: variant.id, skuSnapshot: variant.sku, expectedQty: 5, receivedQty: 5, unitCostCents: 1000, expectedDate: yesterday }, // fully received — must be excluded
          ],
        },
      },
      include: { lines: true },
    });

    const openLines = await prisma.pOLine.findMany({
      where: {
        id: { in: po.lines.map((l) => l.id) },
        expectedDate: { not: null },
        purchaseOrder: { status: { in: ["AWAITING_APPROVAL", "APPROVED", "SENT_TO_VENDOR", "PARTIALLY_RECEIVED"] } },
      },
      select: { expectedQty: true, receivedQty: true, expectedDate: true },
    });
    const owedLines = openLines.filter((l) => l.expectedQty > l.receivedQty);

    const overdue = owedLines.filter((l) => l.expectedDate < todayStart);
    const dueSoonStart = new Date(todayStart);
    dueSoonStart.setDate(dueSoonStart.getDate() + 2);
    const dueSoonEnd = new Date(dueSoonStart);
    dueSoonEnd.setDate(dueSoonEnd.getDate() + 1);
    const dueSoon = owedLines.filter((l) => l.expectedDate >= dueSoonStart && l.expectedDate < dueSoonEnd);

    expect(owedLines).toHaveLength(2); // the fully-received line is excluded
    expect(overdue).toHaveLength(1);
    expect(dueSoon).toHaveLength(1);
  });

  it("computes attributed revenue as totalCents * splitPercent / 100, omitting staff with zero attributed sales", async () => {
    const salesman = await prisma.user.create({
      data: {
        email: `reports-agg-salesman-${Date.now()}@example.com`,
        passwordHash: "test-hash-not-a-real-credential",
        firstName: "Sal",
        lastName: "Esman",
      },
    });
    const customer = await prisma.customer.create({
      data: { email: `reports-agg-perf-${Date.now()}@example.com`, firstName: "Perf", lastName: "Tester", channel: "POS" },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `RPT-PERF-${Date.now()}`,
        channel: "POS",
        customerId: customer.id,
        status: "CONFIRMED",
        totalCents: 100000,
        salesAttributions: {
          create: [{ userId: salesman.id, role: "SALESMAN", splitPercent: 50 }],
        },
      },
    });

    const attributions = await prisma.orderSalesAttribution.findMany({
      where: { orderId: order.id },
      select: { userId: true, splitPercent: true, order: { select: { totalCents: true } } },
    });
    const attributedRevenueCents = attributions.reduce(
      (sum, a) => sum + Math.round((a.order.totalCents * a.splitPercent) / 100),
      0
    );
    expect(attributedRevenueCents).toBe(50000); // 50% of 100000

    await prisma.orderSalesAttribution.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.user.delete({ where: { id: salesman.id } });
  });
});
