const { prisma } = require("@big-eds/database");
const posService = require("./pos.service");

// Kept in its own file, separate from pos.service.test.js, rather than as a
// nested describe there: adding these 3 order-creating tests into that
// already order-heavy file was observed to reliably trigger a P2002
// (orderNumber unique constraint) collision a few tests later, exhausting
// createWithSequentialNumber's retry budget (see lib/sequentialNumber.js) —
// reproducible on the combined file, but NOT reproducible running either
// the original file alone or these 3 tests' ringSale calls in a standalone
// script outside Vitest. The real cause is specific to this Vitest
// project's test-file volume/scheduling, not a bug in ringSale's cost-floor
// logic itself (confirmed correct via the standalone repro) — splitting
// into a second file sidesteps it without touching the proven-stable
// original file. vitest.config.mjs's fileParallelism:false still guarantees
// this file and pos.service.test.js never run concurrently with each other.
describe("pos.service — cost floor (Purchase Price feature)", () => {
  let location;
  let register;
  let product;
  let variant;
  let costedVariant;
  const createdOrderIds = [];

  beforeAll(async () => {
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
    // a sale" rule in ringSale (pos.service.js).
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `COST-FLOOR-NULL-${Date.now()}`, name: "Default", priceCents: 50000 },
    });
    await prisma.stockBalance.create({ data: { variantId: variant.id, locationId: location.id, onHand: 5 } });

    costedVariant = await prisma.variant.create({
      data: {
        productId: product.id,
        sku: `COST-FLOOR-KNOWN-${Date.now()}`,
        name: "Cost Floor Test",
        priceCents: 50000,
        costCents: 30000,
      },
    });
    await prisma.stockBalance.create({ data: { variantId: costedVariant.id, locationId: location.id, onHand: 10 } });
  });

  afterAll(async () => {
    for (const orderId of createdOrderIds) {
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
  });

  it("allows a discount that keeps the total at or above cost", async () => {
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    // priceCents 50000, costCents 30000 — a 15000 discount lands exactly at
    // cost (35000), which must still be allowed (the floor is "at or
    // above", not "strictly above").
    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: costedVariant.id, quantity: 1 }],
      tenderMethod: "CASH",
      tenderedCents: 35000,
      discountCents: 15000,
      discountReasonCode: "at_cost_test",
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
        tenderMethod: "CASH",
        tenderedCents: 25000,
        discountCents: 25000,
        discountReasonCode: "below_cost_test",
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
      tenderMethod: "CASH",
      tenderedCents: 1,
      discountCents: 49999,
      discountReasonCode: "unknown_cost_test",
      performedById: null,
    });
    createdOrderIds.push(result.order.id);

    expect(result.order.totalCents).toBe(1);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 1 });
  });
});
