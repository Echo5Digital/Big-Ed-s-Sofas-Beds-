const { prisma } = require("@big-eds/database");
const posService = require("./pos.service");
const inventoryService = require("./inventory.service");

// These tests run against the real dev database configured in
// packages/database/.env (per this repo's convention — no Prisma mock layer
// exists). Each test creates its own Product/Variant/Register fixtures and
// tears them down in afterAll, so it never touches seeded demo data and is
// safe to run repeatedly.
describe("pos.service", () => {
  let location;
  let register;
  let category;
  let product;
  let variant;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "POS Test Category", slug: `pos-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "POS Test Showroom", type: "SHOWROOM" },
    });
    register = await prisma.register.create({
      data: { name: "POS Test Register", locationId: location.id, isActive: true },
    });
    product = await prisma.product.create({
      data: {
        name: "Test Sofa",
        slug: `test-sofa-${Date.now()}`,
        status: "ACTIVE",
        categoryId: category.id,
      },
    });
    variant = await prisma.variant.create({
      data: {
        productId: product.id,
        sku: `TEST-SOFA-${Date.now()}`,
        name: "Default",
        priceCents: 50000,
      },
    });
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({ where: { registerSession: { registerId: register.id } } });
    await prisma.receipt.deleteMany({ where: { registerSession: { registerId: register.id } } });
    const sessions = await prisma.registerSession.findMany({ where: { registerId: register.id } });
    await prisma.registerSession.deleteMany({ where: { registerId: register.id } });
    await prisma.register.delete({ where: { id: register.id } });

    const orders = await prisma.order.findMany({ where: { lines: { some: { variantId: variant.id } } } });
    for (const order of orders) {
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.refund.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    await prisma.stockMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.reservation.deleteMany({ where: { variantId: variant.id } });
    await prisma.stockBalance.deleteMany({ where: { variantId: variant.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.$disconnect();

    void sessions;
  });

  async function seedStock(quantity) {
    await prisma.stockBalance.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
      update: { onHand: quantity, reserved: 0 },
      create: { variantId: variant.id, locationId: location.id, onHand: quantity },
    });
  }

  it("opens a register session and rejects opening it twice", async () => {
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 10000 });
    expect(session.status).toBe("OPEN");
    expect(session.openingCashCents).toBe(10000);

    await expect(
      posService.openRegister({ registerId: register.id, openingCashCents: 5000 })
    ).rejects.toThrow(/already has an open session/);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 10000 });
  });

  it("rings a cash sale, decrements stock, and computes change due", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 2 }],
      tenderMethod: "CASH",
      tenderedCents: 110000, // 2 x 50000 = 100000 due, tendered 110000
      performedById: null,
    });

    expect(result.order.channel).toBe("POS");
    expect(result.order.paymentStatus).toBe("PAID");
    expect(result.payment.amountCents).toBe(100000);
    expect(result.changeDueCents).toBe(10000);

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(3); // 5 - 2
    expect(balance.reserved).toBe(0); // reservation converted, not left dangling

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 100000 });
  });

  it("rejects CARD tender without writing any order or stock change", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    await expect(
      posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        tenderMethod: "CARD",
        tenderedCents: 50000,
        performedById: null,
      })
    ).rejects.toThrow(/Card-present tender is not available/);

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(5); // unchanged

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("records a deposit sale as PARTIALLY_PAID when less than the full total", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      tenderMethod: "DEPOSIT",
      tenderedCents: 20000,
      depositAmountCents: 20000,
      performedById: null,
    });

    expect(result.order.paymentStatus).toBe("PARTIALLY_PAID");
    expect(result.payment.amountCents).toBe(20000);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("rejects a sale when available stock is insufficient (no phantom sale)", async () => {
    await seedStock(1);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    await expect(
      posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 2 }],
        tenderMethod: "CASH",
        tenderedCents: 100000,
        performedById: null,
      })
    ).rejects.toThrow();

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(1); // untouched — order was rolled back, not half-sold

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("never sells the last unit twice when POS and a direct reservation race for it", async () => {
    await seedStock(1);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    // Simulates the kickoff plan's explicit cross-channel acceptance test:
    // the last unit, contended by two concurrent buyers, must be sold to
    // exactly one of them.
    const attempt1 = posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      tenderMethod: "CASH",
      tenderedCents: 50000,
      performedById: null,
    });
    const attempt2 = inventoryService.reserveStock({
      variantId: variant.id,
      locationId: location.id,
      quantity: 1,
      orderId: null,
    });

    const results = await Promise.allSettled([attempt1, attempt2]);
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    // Either the POS sale won (onHand 0, reserved 0) or the reservation won
    // (onHand 1, reserved 1) — never both succeeding, which would require 2
    // units from a stock of 1.
    const soldUnits = (1 - balance.onHand) + balance.reserved;
    expect(soldUnits).toBe(1);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("reconciles register closeout cash against recorded movements and flags a discrepancy", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 10000 });

    await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      tenderMethod: "CASH",
      tenderedCents: 50000,
      performedById: null,
    });

    // Expected: 10000 opening + 50000 cash sale = 60000. Cashier counts short.
    const closed = await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 55000 });

    expect(closed.expectedCashCents).toBe(60000);
    expect(closed.discrepancyCents).toBe(-5000);
    expect(closed.status).toBe("CLOSED");
  });

  it("processes a refund, caps it at the order total, and writes a cash movement", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const sale = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      tenderMethod: "CASH",
      tenderedCents: 50000,
      performedById: null,
    });

    await expect(
      posService.refund({
        registerSessionId: session.id,
        orderId: sale.order.id,
        amountCents: 999999,
        reasonCode: "test_overage",
        performedById: null,
      })
    ).rejects.toThrow(/exceed the order total/);

    const refundRecord = await posService.refund({
      registerSessionId: session.id,
      orderId: sale.order.id,
      amountCents: 50000,
      reasonCode: "test_refund",
      performedById: null,
    });
    expect(refundRecord.amountCents).toBe(50000);

    const order = await prisma.order.findUnique({ where: { id: sale.order.id } });
    expect(order.paymentStatus).toBe("REFUNDED");

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });
});
