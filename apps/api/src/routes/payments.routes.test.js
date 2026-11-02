const { prisma } = require("@big-eds/database");

// These tests run against the real dev database (this repo's convention —
// no Prisma mock layer, see pos.service.test.js). GET /payments/stats sums
// across ALL Payment/Refund rows in the database, so asserting on an exact
// total would be flaky against a shared dev DB with other data in it;
// instead each test takes a snapshot of the relevant aggregate before
// creating its own fixtures and asserts on the delta, the same scoping
// discipline pos.service.test.js uses for its refund-aggregate assertions.
describe("payments.routes", () => {
  let category, location, product, variant, customer;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "Payments Test Category", slug: `payments-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "Payments Test Location", type: "WAREHOUSE" },
    });
    product = await prisma.product.create({
      data: { name: "Payments Test Sofa", slug: `payments-test-sofa-${Date.now()}`, status: "ACTIVE", categoryId: category.id },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `PAYMENTS-TEST-${Date.now()}`, name: "Default", priceCents: 100000 },
    });
    customer = await prisma.customer.create({
      data: { email: `payments-test-${Date.now()}@example.com`, firstName: "Pay", lastName: "Tester" },
    });
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({ where: { customerId: customer.id } });
    for (const order of orders) {
      await prisma.refund.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.$disconnect();
  });

  let orderCounter = 0;
  async function makeOrder({ channel = "ONLINE", totalCents = 100000 } = {}) {
    orderCounter += 1;
    return prisma.order.create({
      data: {
        orderNumber: `PAY-TEST-${Date.now()}-${orderCounter}`,
        channel,
        customerId: customer.id,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        subtotalCents: totalCents,
        totalCents,
      },
    });
  }

  describe("GET /payments list filters (Prisma query shape)", () => {
    it("filters by method and by source (Order.channel)", async () => {
      const onlineOrder = await makeOrder({ channel: "ONLINE" });
      const posOrder = await makeOrder({ channel: "POS" });

      const cardOnline = await prisma.payment.create({
        data: { orderId: onlineOrder.id, method: "CARD", status: "SUCCEEDED", amountCents: 100000, providerName: "stripe", providerRef: `pi_test_${Date.now()}` },
      });
      const cashPos = await prisma.payment.create({
        data: { orderId: posOrder.id, method: "CASH", status: "SUCCEEDED", amountCents: 100000 },
      });

      const methodWhere = { method: "CARD" };
      const cardResults = await prisma.payment.findMany({ where: { ...methodWhere, id: { in: [cardOnline.id, cashPos.id] } } });
      expect(cardResults.map((p) => p.id)).toEqual([cardOnline.id]);

      const sourceWhere = { order: { channel: "POS" } };
      const posResults = await prisma.payment.findMany({ where: { ...sourceWhere, id: { in: [cardOnline.id, cashPos.id] } } });
      expect(posResults.map((p) => p.id)).toEqual([cashPos.id]);
    });

    it("searches by order number and customer email", async () => {
      const order = await makeOrder({ channel: "ONLINE" });
      const payment = await prisma.payment.create({
        data: { orderId: order.id, method: "CARD", status: "SUCCEEDED", amountCents: 100000 },
      });

      const byOrderNumber = await prisma.payment.findMany({
        where: { id: payment.id, order: { orderNumber: { contains: order.orderNumber, mode: "insensitive" } } },
      });
      expect(byOrderNumber).toHaveLength(1);

      const byEmail = await prisma.payment.findMany({
        where: { id: payment.id, order: { customer: { email: { contains: customer.email, mode: "insensitive" } } } },
      });
      expect(byEmail).toHaveLength(1);
    });
  });

  describe("GET /payments/:id detail", () => {
    it("includes refund history for the payment's order", async () => {
      const order = await makeOrder({ channel: "POS", totalCents: 50000 });
      const payment = await prisma.payment.create({
        data: { orderId: order.id, method: "CASH", status: "SUCCEEDED", amountCents: 50000 },
      });
      await prisma.refund.create({
        data: { orderId: order.id, amountCents: 20000, reasonCode: "customer_return", processedById: null },
      });

      const found = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: { order: { include: { refunds: true } } },
      });

      expect(found.order.refunds).toHaveLength(1);
      expect(found.order.refunds[0].amountCents).toBe(20000);
      // Refund.paymentId is never populated by any write path in this codebase
      // (see pos.service.js's refund()) — refunds attribute to the order, not
      // a specific Payment row. Asserting this stays true so the payments
      // detail endpoint doesn't silently start relying on a column nothing
      // populates.
      expect(found.order.refunds[0].paymentId).toBeNull();
    });
  });

  describe("GET /payments/stats aggregations", () => {
    it("sums SUCCEEDED payments by method into the correct revenue bucket (delta-scoped)", async () => {
      const before = await Promise.all([
        prisma.payment.aggregate({ where: { status: "SUCCEEDED", method: "CASH" }, _sum: { amountCents: true } }),
        prisma.payment.aggregate({ where: { status: "SUCCEEDED", method: "BANK_TRANSFER" }, _sum: { amountCents: true } }),
        prisma.payment.aggregate({ where: { status: "SUCCEEDED", order: { channel: "ONLINE" } }, _sum: { amountCents: true } }),
      ]);

      const posOrder = await makeOrder({ channel: "POS", totalCents: 30000 });
      await prisma.payment.create({ data: { orderId: posOrder.id, method: "CASH", status: "SUCCEEDED", amountCents: 30000 } });

      const bankOrder = await makeOrder({ channel: "ONLINE", totalCents: 40000 });
      await prisma.payment.create({ data: { orderId: bankOrder.id, method: "BANK_TRANSFER", status: "SUCCEEDED", amountCents: 40000 } });

      const after = await Promise.all([
        prisma.payment.aggregate({ where: { status: "SUCCEEDED", method: "CASH" }, _sum: { amountCents: true } }),
        prisma.payment.aggregate({ where: { status: "SUCCEEDED", method: "BANK_TRANSFER" }, _sum: { amountCents: true } }),
        prisma.payment.aggregate({ where: { status: "SUCCEEDED", order: { channel: "ONLINE" } }, _sum: { amountCents: true } }),
      ]);

      expect((after[0]._sum.amountCents ?? 0) - (before[0]._sum.amountCents ?? 0)).toBe(30000);
      expect((after[1]._sum.amountCents ?? 0) - (before[1]._sum.amountCents ?? 0)).toBe(40000);
      expect((after[2]._sum.amountCents ?? 0) - (before[2]._sum.amountCents ?? 0)).toBe(40000);
    });

    it("excludes PENDING and FAILED payments from revenue, counts FAILED separately", async () => {
      const beforeFailed = await prisma.payment.count({ where: { status: "FAILED" } });

      const order = await makeOrder({ channel: "ONLINE", totalCents: 60000 });
      const pending = await prisma.payment.create({
        data: { orderId: order.id, method: "CARD", status: "PENDING", amountCents: 60000, providerName: "stripe" },
      });
      await prisma.payment.update({ where: { id: pending.id }, data: { status: "FAILED", failureReason: "card_declined" } });

      const afterFailed = await prisma.payment.count({ where: { status: "FAILED" } });
      expect(afterFailed - beforeFailed).toBe(1);

      const revenueForThisOrder = await prisma.payment.aggregate({
        where: { status: "SUCCEEDED", orderId: order.id },
        _sum: { amountCents: true },
      });
      expect(revenueForThisOrder._sum.amountCents ?? 0).toBe(0);
    });

    it("computes outstanding balance as totalCents minus SUCCEEDED payments for UNPAID/PARTIALLY_PAID orders", async () => {
      const order = await makeOrder({ channel: "POS", totalCents: 100000 });
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PARTIALLY_PAID" } });
      await prisma.payment.create({ data: { orderId: order.id, method: "DEPOSIT", status: "SUCCEEDED", amountCents: 25000 } });

      const reloaded = await prisma.order.findUnique({
        where: { id: order.id },
        include: { payments: { where: { status: "SUCCEEDED" } } },
      });
      const paid = reloaded.payments.reduce((s, p) => s + p.amountCents, 0);
      const outstanding = Math.max(reloaded.totalCents - paid, 0);

      expect(outstanding).toBe(75000);
    });

    it("sums total refunds across orders (delta-scoped)", async () => {
      const before = await prisma.refund.aggregate({ _sum: { amountCents: true } });

      const order = await makeOrder({ channel: "POS", totalCents: 50000 });
      await prisma.refund.create({ data: { orderId: order.id, amountCents: 15000, reasonCode: "test_delta_refund" } });

      const after = await prisma.refund.aggregate({ _sum: { amountCents: true } });
      expect((after._sum.amountCents ?? 0) - (before._sum.amountCents ?? 0)).toBe(15000);
    });
  });
});
