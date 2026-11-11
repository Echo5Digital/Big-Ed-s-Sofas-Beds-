const { prisma } = require("@big-eds/database");
const posService = require("./pos.service");
const posReturnsService = require("./posReturns.service");

// Same conventions as pos.service.test.js: runs against the real dev
// database, each test creates its own fixtures and cleans up after itself.
describe("posReturns.service", () => {
  let location;
  let register;
  let category;
  let product;
  let variant; // priceCents 40000
  let replacementVariant; // priceCents 50000, for exchanges
  let customer;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "Returns Test Category", slug: `returns-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({ data: { name: "Returns Test Showroom", type: "SHOWROOM" } });
    register = await prisma.register.create({
      data: { name: "Returns Test Register", locationId: location.id, isActive: true },
    });
    product = await prisma.product.create({
      data: { name: "Returns Test Sofa", slug: `returns-test-sofa-${Date.now()}`, status: "ACTIVE", categoryId: category.id },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `RETURNS-TEST-${Date.now()}`, name: "Default", priceCents: 40000 },
    });
    replacementVariant = await prisma.variant.create({
      data: { productId: product.id, sku: `RETURNS-REPLACEMENT-${Date.now()}`, name: "Premium", priceCents: 50000 },
    });
    customer = await prisma.customer.create({
      data: { firstName: "Returns", lastName: "Test Customer", phone: `555-${Date.now().toString().slice(-7)}` },
    });
  });

  afterAll(async () => {
    await prisma.returnLine.deleteMany({ where: { variantId: { in: [variant.id, replacementVariant.id] } } });
    await prisma.returnTransaction.deleteMany({ where: { registerSessionId: { in: await sessionIds() } } });
    await prisma.storeCredit.deleteMany({ where: { customerId: customer.id } });
    await prisma.cashMovement.deleteMany({ where: { registerSession: { registerId: register.id } } });
    await prisma.receipt.deleteMany({ where: { registerSession: { registerId: register.id } } });
    await prisma.registerSession.deleteMany({ where: { registerId: register.id } });
    await prisma.register.delete({ where: { id: register.id } });

    const orders = await prisma.order.findMany({ where: { lines: { some: { variantId: { in: [variant.id, replacementVariant.id] } } } } });
    for (const order of orders) {
      await prisma.refund.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    }
    await prisma.stockMovement.deleteMany({ where: { variantId: { in: [variant.id, replacementVariant.id] } } });
    await prisma.reservation.deleteMany({ where: { variantId: { in: [variant.id, replacementVariant.id] } } });
    await prisma.stockBalance.deleteMany({ where: { variantId: { in: [variant.id, replacementVariant.id] } } });
    await prisma.variant.deleteMany({ where: { id: { in: [variant.id, replacementVariant.id] } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.$disconnect();
  });

  async function sessionIds() {
    const sessions = await prisma.registerSession.findMany({ where: { registerId: register.id }, select: { id: true } });
    return sessions.map((s) => s.id);
  }

  // The shared `register` fixture can only have one OPEN session at a time
  // (same constraint posService.openRegister always enforced), and unlike
  // pos.service.test.js's tests — which each explicitly close their own
  // session — these tests need the session to stay open through both the
  // sale AND the return/exchange that follows it. Closing automatically
  // after each test (rather than threading a closeRegister call into every
  // test body) keeps the register free for the next test's ringTestSale().
  afterEach(async () => {
    const openSession = await prisma.registerSession.findFirst({
      where: { registerId: register.id, status: "OPEN" },
    });
    if (openSession) {
      await posService.closeRegister({ registerSessionId: openSession.id, closingCashCents: 0 });
    }
  });

  async function seedStock(v, quantity) {
    await prisma.stockBalance.upsert({
      where: { variantId_locationId: { variantId: v.id, locationId: location.id } },
      update: { onHand: quantity, reserved: 0, quarantined: 0 },
      create: { variantId: v.id, locationId: location.id, onHand: quantity },
    });
  }

  async function ringTestSale({ quantity = 1, withCustomer = false } = {}) {
    await seedStock(variant, 10);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
    const sale = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity }],
      payments: [{ method: "CASH", amountCents: 40000 * quantity }],
      customerId: withCustomer ? customer.id : undefined,
      performedById: null,
    });
    return { session, sale };
  }

  it("finds an order by order number and reports eligible return quantity", async () => {
    const { sale } = await ringTestSale();
    const result = await posReturnsService.findOrderForReturn({ q: sale.order.orderNumber });
    expect(result.order.id).toBe(sale.order.id);
    expect(result.lines[0].eligibleQty).toBe(1);
    expect(result.lines[0].previouslyReturnedQty).toBe(0);
  });

  it("finds an order by customer phone", async () => {
    const { sale } = await ringTestSale({ withCustomer: true });
    const result = await posReturnsService.findOrderForReturn({ q: customer.phone });
    expect(result.order.id).toBe(sale.order.id);
  });

  it("processes a sellable cash return and restocks on-hand", async () => {
    const { session, sale } = await ringTestSale({ quantity: 2 });
    const balanceBefore = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });

    const result = await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [
        {
          orderLineId: sale.order.lines[0].id,
          quantity: 1,
          condition: "SELLABLE",
          reasonCode: "CUSTOMER_CHANGED_MIND",
        },
      ],
      refundMethod: "CASH",
      performedById: null,
    });

    expect(result.refundRecord.amountCents).toBe(40000);
    const balanceAfter = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balanceAfter.onHand).toBe(balanceBefore.onHand + 1);
    expect(balanceAfter.quarantined).toBe(balanceBefore.quarantined);

    const movement = await prisma.stockMovement.findFirst({
      where: { referenceId: result.returnTransaction.id, type: "RETURN_RESTOCK" },
    });
    expect(movement).not.toBeNull();
  });

  it("quarantines a damaged return instead of restocking it", async () => {
    const { session, sale } = await ringTestSale();
    const balanceBefore = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });

    await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [
        { orderLineId: sale.order.lines[0].id, quantity: 1, condition: "DAMAGED", reasonCode: "DAMAGED_PRODUCT" },
      ],
      refundMethod: "CASH",
      performedById: null,
    });

    const balanceAfter = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balanceAfter.onHand).toBe(balanceBefore.onHand); // never added back to sellable stock
    expect(balanceAfter.quarantined).toBe(balanceBefore.quarantined + 1);
  });

  it("prevents returning more than the eligible quantity", async () => {
    const { session, sale } = await ringTestSale({ quantity: 1 });

    await expect(
      posReturnsService.createReturn({
        orderId: sale.order.id,
        registerSessionId: session.id,
        lines: [
          { orderLineId: sale.order.lines[0].id, quantity: 2, condition: "SELLABLE", reasonCode: "OTHER" },
        ],
        refundMethod: "CASH",
        performedById: null,
      })
    ).rejects.toThrow(/exceeds the eligible quantity/);
  });

  it("prevents a second return from exceeding the remaining eligible quantity after a first return", async () => {
    const { session, sale } = await ringTestSale({ quantity: 2 });

    await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
      refundMethod: "CASH",
      performedById: null,
    });

    await expect(
      posReturnsService.createReturn({
        orderId: sale.order.id,
        registerSessionId: session.id,
        lines: [{ orderLineId: sale.order.lines[0].id, quantity: 2, condition: "SELLABLE", reasonCode: "OTHER" }],
        refundMethod: "CASH",
        performedById: null,
      })
    ).rejects.toThrow(/exceeds the eligible quantity/);
  });

  it("prevents a duplicate refund on an order that's already been fully refunded", async () => {
    const { session, sale } = await ringTestSale({ quantity: 2 });

    // Fully return and refund the order (both units) in one pass.
    await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [{ orderLineId: sale.order.lines[0].id, quantity: 2, condition: "SELLABLE", reasonCode: "OTHER" }],
      refundMethod: "CASH",
      performedById: null,
    });

    const order = await prisma.order.findUnique({ where: { id: sale.order.id } });
    expect(order.paymentStatus).toBe("REFUNDED");

    // Every unit is already returned, so a second return attempt against
    // the same line is rejected by the return-quantity cap before it can
    // even reach refund()'s own dollar-total cap.
    await expect(
      posReturnsService.createReturn({
        orderId: sale.order.id,
        registerSessionId: session.id,
        lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
        refundMethod: "CASH",
        performedById: null,
      })
    ).rejects.toThrow(/exceeds the eligible quantity/);
  });

  it("issues store credit instead of a cash Refund row when refundMethod is STORE_CREDIT", async () => {
    const { session, sale } = await ringTestSale({ quantity: 1, withCustomer: true });

    const balanceBefore = await require("./storeCredit.service").getStoreCreditBalance(customer.id);

    const result = await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
      refundMethod: "STORE_CREDIT",
      performedById: null,
    });

    expect(result.refundRecord).toBeNull();
    expect(result.storeCreditRecord.amountCents).toBe(40000);

    const balanceAfter = await require("./storeCredit.service").getStoreCreditBalance(customer.id);
    expect(balanceAfter).toBe(balanceBefore + 40000);

    const order = await prisma.order.findUnique({ where: { id: sale.order.id } });
    expect(order.paymentStatus).toBe("REFUNDED");
  });

  it("rejects a store-credit refund when the order has no identified customer", async () => {
    const { session, sale } = await ringTestSale({ quantity: 1, withCustomer: false });

    await expect(
      posReturnsService.createReturn({
        orderId: sale.order.id,
        registerSessionId: session.id,
        lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
        refundMethod: "STORE_CREDIT",
        performedById: null,
      })
    ).rejects.toThrow(/identified customer/);
  });

  it("exchange: replacement costs more — collects the balance via a payment entry", async () => {
    await seedStock(replacementVariant, 10);
    const { session, sale } = await ringTestSale({ quantity: 1 }); // 40000 sale

    const result = await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
      exchangeReplacements: [{ variantId: replacementVariant.id, quantity: 1 }], // 50000 replacement
      balancePayments: [{ method: "CASH", amountCents: 10000 }],
      performedById: null,
    });

    expect(result.balanceDueCents).toBe(10000);
    expect(result.exchangePayments).toHaveLength(1);
    expect(result.exchangePayments[0].amountCents).toBe(10000);
    expect(result.exchangeOrder.totalCents).toBe(50000);
  });

  it("exchange: replacement costs less — issues a refund for the difference", async () => {
    await seedStock(variant, 10);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
    const sale = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: replacementVariant.id, quantity: 1 }], // 50000 sale
      payments: [{ method: "CASH", amountCents: 50000 }],
      performedById: null,
    });

    const result = await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
      exchangeReplacements: [{ variantId: variant.id, quantity: 1 }], // 40000 replacement
      refundMethod: "CASH",
      performedById: null,
    });

    expect(result.balanceDueCents).toBe(0);
    expect(result.refundRecord.amountCents).toBe(10000);
  });

  it("exchange: equal replacement price — no payment or refund row created", async () => {
    await seedStock(variant, 10);
    const { session, sale } = await ringTestSale({ quantity: 1 }); // 40000 sale, same-priced replacement

    const result = await posReturnsService.createReturn({
      orderId: sale.order.id,
      registerSessionId: session.id,
      lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
      exchangeReplacements: [{ variantId: variant.id, quantity: 1 }],
      performedById: null,
    });

    expect(result.balanceDueCents).toBe(0);
    expect(result.refundRecord).toBeNull();
    expect(result.exchangePayments).toHaveLength(0);
  });

  it("rejects an exchange when the balance due is not fully collected", async () => {
    await seedStock(replacementVariant, 10);
    const { session, sale } = await ringTestSale({ quantity: 1 });

    await expect(
      posReturnsService.createReturn({
        orderId: sale.order.id,
        registerSessionId: session.id,
        lines: [{ orderLineId: sale.order.lines[0].id, quantity: 1, condition: "SELLABLE", reasonCode: "OTHER" }],
        exchangeReplacements: [{ variantId: replacementVariant.id, quantity: 1 }],
        balancePayments: [{ method: "CASH", amountCents: 5000 }], // short of the 10000 owed
        performedById: null,
      })
    ).rejects.toThrow(/Balance due was not fully collected/);
  });
});
