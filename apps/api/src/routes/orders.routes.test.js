const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { createApp } = require("../app");

// Runs against the real dev database and a real Square Sandbox API call
// (same conventions as pos.service.test.js — no Prisma or Square mock layer
// exists in this repo). Each test creates its own fixtures and tears them
// down in afterAll.
describe("orders.routes — POST /checkout tax", () => {
  const app = createApp();
  let warehouse;
  let category;
  let product;
  let taxedVariant; // priceCents 50000, taxRatePercent 8.25
  let zeroTaxVariant; // priceCents 30000, taxRatePercent 0

  beforeAll(async () => {
    warehouse = await prisma.location.findFirst({ where: { type: "WAREHOUSE", isActive: true } });
    category = await prisma.category.create({
      data: { name: "Checkout Tax Test Category", slug: `checkout-tax-test-category-${Date.now()}` },
    });
    product = await prisma.product.create({
      data: { name: "Checkout Tax Test Sofa", slug: `checkout-tax-test-sofa-${Date.now()}`, status: "ACTIVE", categoryId: category.id },
    });
    taxedVariant = await prisma.variant.create({
      data: { productId: product.id, sku: `CHECKOUT-TAX-${Date.now()}`, name: "Taxed", priceCents: 50000, taxRatePercent: 8.25 },
    });
    zeroTaxVariant = await prisma.variant.create({
      data: { productId: product.id, sku: `CHECKOUT-NOTAX-${Date.now()}`, name: "Zero Tax", priceCents: 30000, taxRatePercent: 0 },
    });
    await prisma.stockBalance.createMany({
      data: [
        { variantId: taxedVariant.id, locationId: warehouse.id, onHand: 10 },
        { variantId: zeroTaxVariant.id, locationId: warehouse.id, onHand: 10 },
      ],
    });
  });

  afterAll(async () => {
    const variantIds = [taxedVariant.id, zeroTaxVariant.id];
    const orders = await prisma.order.findMany({ where: { lines: { some: { variantId: { in: variantIds } } } } });
    // checkoutPayload() creates a fresh Customer per call (unique email via
    // Date.now()) through /api/checkout's upsert — collect them here so this
    // cleanup doesn't leave one stranded row behind per test.
    const customerIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean))];
    for (const order of orders) {
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.reservation.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    if (customerIds.length) {
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }
    await prisma.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.reservation.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.stockBalance.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.variant.deleteMany({ where: { id: { in: variantIds } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.$disconnect();
  }, 30000);

  function checkoutPayload(lines) {
    return {
      lines,
      fulfillmentMethod: "PICKUP",
      customer: {
        email: `checkout-tax-test-${Date.now()}@test.local`,
        firstName: "Tax",
        lastName: "Tester",
      },
    };
  }

  it("charges the variant's flat tax rate on top of the subtotal, reflected in the Square payment amount", async () => {
    const res = await request(app)
      .post("/api/checkout")
      .send(checkoutPayload([{ variantId: taxedVariant.id, quantity: 1 }]));

    expect(res.status).toBe(201);
    // 50000 * 8.25% = 4125 tax -> 54125 total.
    expect(res.body.order.subtotalCents).toBe(50000);
    expect(res.body.order.taxCents).toBe(4125);
    expect(res.body.order.totalCents).toBe(54125);
    expect(res.body.order.lines[0].taxCents).toBe(4125);
    expect(res.body.order.lines[0].lineTotalCents).toBe(54125);

    const payment = await prisma.payment.findFirst({ where: { orderId: res.body.order.id } });
    // The real Square payment is created for the tax-inclusive total —
    // this is the figure Square will actually attempt to collect.
    expect(payment.amountCents).toBe(54125);
  });

  it("sums per-line tax independently across a mixed-rate cart", async () => {
    const res = await request(app).post("/api/checkout").send(
      checkoutPayload([
        { variantId: taxedVariant.id, quantity: 1 }, // 50000 @ 8.25% -> 4125 tax
        { variantId: zeroTaxVariant.id, quantity: 1 }, // 30000 @ 0% -> 0 tax
      ])
    );

    expect(res.status).toBe(201);
    expect(res.body.order.subtotalCents).toBe(80000);
    expect(res.body.order.taxCents).toBe(4125);
    expect(res.body.order.totalCents).toBe(84125);
  });
});
