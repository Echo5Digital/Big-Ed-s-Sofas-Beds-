const bcrypt = require("bcryptjs");
const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { createApp } = require("../app");
const { signAccessToken, ACCESS_COOKIE } = require("../lib/tokens");

// HTTP-level coverage for POST /pos/sales's CARD dispatch — routing to
// pos.service.js's createCardCheckout instead of the old blanket 501, and
// rejecting a CARD entry mixed with another tender method (a card sale is
// single-tender only; see TenderModal.jsx/createCardCheckout's own
// comments). Runs against the real dev database (no Prisma mock layer in
// this repo). The actual square.terminal.checkouts.create call (requires a
// real paired device) is not exercised here — see
// pos.cardCheckout.test.js for the parts of this flow that can be tested
// without one, and docs/requirements/open-questions.md for what's still
// pending.
describe("pos.routes — POST /pos/sales (CARD dispatch)", () => {
  const app = createApp();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let cashierUser;
  let cashierCookie;
  let location;
  let registerNoDevice;
  let category;
  let product;
  let variant;
  const createdOrderIds = [];

  beforeAll(async () => {
    const cashierRole = await prisma.role.findUniqueOrThrow({ where: { name: "CASHIER" } });
    const passwordHash = await bcrypt.hash("TestPassword123!", 10);
    cashierUser = await prisma.user.create({
      data: {
        email: `pos-card-sale-cashier-${suffix}@example.com`,
        passwordHash,
        firstName: "Card Sale",
        lastName: "Cashier",
        isActive: true,
        roles: { create: { roleId: cashierRole.id } },
      },
    });
    cashierCookie = `${ACCESS_COOKIE}=${signAccessToken({ sub: cashierUser.id })}`;

    location = await prisma.location.create({ data: { name: `Card Sale Route Test Location ${suffix}`, type: "SHOWROOM" } });
    registerNoDevice = await prisma.register.create({
      data: { name: `Card Sale Route Test Register ${suffix}`, locationId: location.id, isActive: true },
    });
    category = await prisma.category.create({
      data: { name: "Card Sale Route Test Category", slug: `card-sale-route-test-category-${suffix}` },
    });
    product = await prisma.product.create({
      data: { name: "Card Sale Route Test Sofa", slug: `card-sale-route-test-sofa-${suffix}`, status: "ACTIVE", categoryId: category.id },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `CARD-SALE-ROUTE-TEST-${suffix}`, name: "Default", priceCents: 20000, taxRatePercent: 0 },
    });
    await prisma.stockBalance.create({ data: { variantId: variant.id, locationId: location.id, onHand: 5 } });
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await prisma.payment.deleteMany({ where: { orderId: id } });
      await prisma.orderLine.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await prisma.stockMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.reservation.deleteMany({ where: { variantId: variant.id } });
    await prisma.stockBalance.deleteMany({ where: { variantId: variant.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.registerSession.deleteMany({ where: { registerId: registerNoDevice.id } });
    await prisma.register.delete({ where: { id: registerNoDevice.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.userRole.deleteMany({ where: { userId: cashierUser.id } });
    await prisma.user.delete({ where: { id: cashierUser.id } });
  }, 30000);

  it("rejects a CARD entry split with another tender method, without creating an order", async () => {
    const session = await prisma.registerSession.create({
      data: { registerId: registerNoDevice.id, openingCashCents: 0, status: "OPEN" },
    });

    const res = await request(app)
      .post("/api/pos/sales")
      .set("Cookie", cashierCookie)
      .send({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [
          { method: "CARD", amountCents: 10000 },
          { method: "CASH", amountCents: 10000 },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/can't be split/i);

    const orders = await prisma.order.findMany({ where: { lines: { some: { variantId: variant.id } } } });
    expect(orders).toHaveLength(0);

    await prisma.registerSession.delete({ where: { id: session.id } });
  });

  it("a CARD-only sale on a register with no paired terminal returns 409 from createCardCheckout, not the old 501", async () => {
    const session = await prisma.registerSession.create({
      data: { registerId: registerNoDevice.id, openingCashCents: 0, status: "OPEN" },
    });

    const res = await request(app)
      .post("/api/pos/sales")
      .set("Cookie", cashierCookie)
      .send({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CARD", amountCents: 20000 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/no paired card terminal/i);

    await prisma.registerSession.delete({ where: { id: session.id } });
  });
});
