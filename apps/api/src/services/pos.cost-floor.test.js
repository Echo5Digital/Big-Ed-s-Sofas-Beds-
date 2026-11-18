const { prisma } = require("@big-eds/database");
const posService = require("./pos.service");

// Kept in its own file, separate from pos.service.test.js, rather than as a
// nested describe there: adding these 3 order-creating tests into that
// already order-heavy file was observed to reliably trigger a P2002
// (orderNumber unique constraint) collision a few tests later. That was
// order numbering's old count()+1 scheme racing itself under this dev DB's
// multi-second query latency — fixed at the root by nextSequenceValue's
// atomic counter row (see lib/sequentialNumber.js), so the collision itself
// shouldn't recur. Left split across two files anyway since there's no
// reason to re-merge a proven-stable split. vitest.config.mjs's
// fileParallelism:false still guarantees this file and pos.service.test.js
// never run concurrently with each other.
describe("pos.service — cost floor (Purchase Price feature)", () => {
  let location;
  let register;
  let product;
  let variant;
  let costedVariant;
  let manager;
  const MANAGER_PIN = "2468";
  const createdOrderIds = [];

  beforeAll(async () => {
    const { hashPin } = require("../lib/posPin");
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "MANAGER" } });
    // These tests apply discounts well above the 10% unsupervised ceiling
    // (they're deliberately testing the cost floor, not the ceiling), so
    // they need a real manager PIN to get past the override check first.
    manager = await prisma.user.create({
      data: {
        email: `cost-floor-manager-${Date.now()}@test.local`,
        passwordHash: "unused",
        firstName: "CostFloor",
        lastName: "Manager",
        posPinHash: await hashPin(MANAGER_PIN),
        roles: { create: [{ roleId: managerRole.id }] },
      },
    });

    location = await prisma.location.create({
      data: { name: "Cost Floor Test Warehouse", type: "WAREHOUSE", isActive: true },
    });
    register = await prisma.register.create({
      data: { name: "Cost Floor Test Register", locationId: location.id, isActive: true },
    });
    product = await prisma.product.create({
      data: { name: "Cost Floor Test Product", slug: `cost-floor-test-${Date.now()}`, status: "ACTIVE" },
    });
    // costCents: null on purpose — exercises the "unknown cost never blocks
    // a sale" rule in ringSale (pos.service.js). taxRatePercent: 0 so this
    // file's hardcoded amountCents figures stay about cost-floor behavior,
    // not tax (tax has its own dedicated coverage in pos.service.test.js).
    variant = await prisma.variant.create({
      data: {
        productId: product.id,
        sku: `COST-FLOOR-NULL-${Date.now()}`,
        name: "Default",
        priceCents: 50000,
        taxRatePercent: 0,
      },
    });
    await prisma.stockBalance.create({ data: { variantId: variant.id, locationId: location.id, onHand: 5 } });

    costedVariant = await prisma.variant.create({
      data: {
        productId: product.id,
        sku: `COST-FLOOR-KNOWN-${Date.now()}`,
        name: "Cost Floor Test",
        priceCents: 50000,
        costCents: 30000,
        taxRatePercent: 0,
      },
    });
    await prisma.stockBalance.create({ data: { variantId: costedVariant.id, locationId: location.id, onHand: 10 } });
  });

  afterAll(async () => {
    for (const orderId of createdOrderIds) {
      await prisma.orderSalesAttribution.deleteMany({ where: { orderId } });
      await prisma.payment.deleteMany({ where: { orderId } });
      await prisma.orderLine.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    await prisma.cashMovement.deleteMany({ where: { registerSession: { registerId: register.id } } });
    await prisma.receipt.deleteMany({ where: { registerSession: { registerId: register.id } } });
    await prisma.registerSession.deleteMany({ where: { registerId: register.id } });
    await prisma.register.delete({ where: { id: register.id } });
    await prisma.stockMovement.deleteMany({ where: { variantId: { in: [variant.id, costedVariant.id] } } });
    await prisma.reservation.deleteMany({ where: { variantId: { in: [variant.id, costedVariant.id] } } });
    await prisma.stockBalance.deleteMany({ where: { variantId: { in: [variant.id, costedVariant.id] } } });
    await prisma.variant.deleteMany({ where: { id: { in: [variant.id, costedVariant.id] } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.userRole.deleteMany({ where: { userId: manager.id } });
    await prisma.user.delete({ where: { id: manager.id } });
  });

  it("allows a discount that keeps the total at or above cost", async () => {
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    // priceCents 50000, costCents 30000 — a 15000 discount lands exactly at
    // cost (35000), which must still be allowed (the floor is "at or
    // above", not "strictly above").
    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: costedVariant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 35000 }],
      discount: { mode: "FLAT_CENTS", amountCents: 15000 },
      discountReasonCode: "at_cost_test",
      pinOverride: { approverPin: MANAGER_PIN }, // 30% of subtotal, above the 10% unsupervised ceiling
      performedById: null,
    });
    createdOrderIds.push(result.order.id);

    expect(result.order.totalCents).toBe(35000);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 35000 });
  });

  it("hard-blocks a discount that would sell below cost", async () => {
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const balanceBefore = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: costedVariant.id, locationId: location.id } },
    });

    // priceCents 50000, costCents 30000 — a 25000 discount brings the total
    // to 25000, which is below the 30000 cost and must be rejected.
    await expect(
      posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: costedVariant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 25000 }],
        discount: { mode: "FLAT_CENTS", amountCents: 25000 },
        discountReasonCode: "below_cost_test",
        pinOverride: { approverPin: MANAGER_PIN }, // 50% of subtotal, above the 10% unsupervised ceiling
        performedById: null,
      })
    ).rejects.toThrow(/below the cost of the items/);

    // Confirms the block happened before any stock/order mutation, not
    // after a partial commit — compares against this test's own
    // just-captured baseline, not a hardcoded absolute, since the preceding
    // "allows a discount at cost" test already sold 1 unit of this same
    // fixture's stock.
    const balanceAfter = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: costedVariant.id, locationId: location.id } },
    });
    expect(balanceAfter.onHand).toBe(balanceBefore.onHand);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("does not block a sale for a variant with unknown (null) cost", async () => {
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 1 }],
      discount: { mode: "FLAT_CENTS", amountCents: 49999 },
      discountReasonCode: "unknown_cost_test",
      pinOverride: { approverPin: MANAGER_PIN }, // ~100% of subtotal, above the 10% unsupervised ceiling
      performedById: null,
    });
    createdOrderIds.push(result.order.id);

    expect(result.order.totalCents).toBe(1);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 1 });
  });
});
