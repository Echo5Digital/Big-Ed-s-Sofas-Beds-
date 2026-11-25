const { prisma } = require("@big-eds/database");
const posService = require("./pos.service");

// Covers the parts of the Square Terminal card-present flow that don't
// require a real paired device/Square Sandbox terminal call: createCardCheckout's
// own validation (no device paired, split-tender rejection happens at the
// route layer — see pos.routes.test.js) and the webhook-side completion/
// failure handlers (completeCardCheckout/failCardCheckout), exercised
// directly against a manually-constructed pending order the same shape
// createCardCheckout itself produces, standing in for what the real webhook
// would trigger after Square confirms a terminal checkout. The actual
// square.terminal.checkouts.create call (requires a real paired device) is
// deliberately NOT exercised here — see docs/requirements/open-questions.md.
describe("pos.service — card-present (Square Terminal)", () => {
  let location;
  let registerNoDevice;
  let registerWithDevice;
  let category;
  let product;
  let variant;
  const createdOrderIds = [];

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "Card Checkout Test Category", slug: `card-checkout-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "Card Checkout Test Showroom", type: "SHOWROOM" },
    });
    registerNoDevice = await prisma.register.create({
      data: { name: "Card Checkout Test Register (no device)", locationId: location.id, isActive: true },
    });
    registerWithDevice = await prisma.register.create({
      data: {
        name: "Card Checkout Test Register (paired)",
        locationId: location.id,
        isActive: true,
        squareDeviceId: "test-fake-device-id",
      },
    });
    product = await prisma.product.create({
      data: { name: "Card Checkout Test Sofa", slug: `card-checkout-test-sofa-${Date.now()}`, status: "ACTIVE", categoryId: category.id },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `CARD-CHECKOUT-TEST-${Date.now()}`, name: "Default", priceCents: 50000, taxRatePercent: 0 },
    });
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await prisma.payment.deleteMany({ where: { orderId: id } });
      await prisma.receipt.deleteMany({ where: { orderId: id } });
      await prisma.orderLine.deleteMany({ where: { orderId: id } });
      await prisma.orderSalesAttribution.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await prisma.stockMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.reservation.deleteMany({ where: { variantId: variant.id } });
    await prisma.stockBalance.deleteMany({ where: { variantId: variant.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.registerSession.deleteMany({ where: { registerId: { in: [registerNoDevice.id, registerWithDevice.id] } } });
    await prisma.register.deleteMany({ where: { id: { in: [registerNoDevice.id, registerWithDevice.id] } } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
  }, 30000);

  async function seedStock(registerLocationId, quantity) {
    await prisma.stockBalance.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: registerLocationId } },
      update: { onHand: quantity, reserved: 0 },
      create: { variantId: variant.id, locationId: registerLocationId, onHand: quantity },
    });
  }

  it("rejects a card checkout on a register with no paired terminal", async () => {
    await seedStock(location.id, 5);
    const session = await posService.openRegister({ registerId: registerNoDevice.id, openingCashCents: 0 });

    await expect(
      posService.createCardCheckout({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        performedById: null,
      })
    ).rejects.toThrow(/no paired card terminal/i);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  // Manually constructs the pending DRAFT order + PENDING CARD payment the
  // same shape createCardCheckout produces up to (but not including) the
  // real square.terminal.checkouts.create call, so completeCardCheckout can
  // be exercised the same way the webhook would invoke it — standing in for
  // "Square confirmed the terminal checkout succeeded."
  async function createPendingCardOrder({ registerSessionId }) {
    const orderNumber = `BE-CARDTEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        channel: "POS",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        fulfillmentStatus: "UNALLOCATED",
        fulfillmentMethod: "IN_STORE",
        subtotalCents: 50000,
        taxCents: 0,
        totalCents: 50000,
        lines: {
          create: [
            {
              variantId: variant.id,
              skuSnapshot: variant.sku,
              nameSnapshot: "Card Checkout Test Sofa — Default",
              quantity: 1,
              unitPriceCents: 50000,
              taxCents: 0,
              lineTotalCents: 50000,
            },
          ],
        },
      },
      include: { lines: true },
    });
    createdOrderIds.push(order.id);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        method: "CARD",
        status: "PENDING",
        amountCents: 50000,
        reference: registerSessionId,
        providerRef: `test-terminal-checkout-${order.id}`,
      },
    });
    return { order, payment };
  }

  it("completeCardCheckout reserves+converts stock and confirms the order, mirroring a COMPLETED terminal checkout", async () => {
    await seedStock(location.id, 5);
    const session = await posService.openRegister({ registerId: registerWithDevice.id, openingCashCents: 0 });
    const { order, payment } = await createPendingCardOrder({ registerSessionId: session.id });

    await posService.completeCardCheckout(order.id);

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("CONFIRMED");
    expect(updatedOrder.paymentStatus).toBe("PAID");
    expect(updatedOrder.fulfillmentStatus).toBe("RESERVED");

    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("SUCCEEDED");

    const receipt = await prisma.receipt.findFirst({ where: { orderId: order.id } });
    expect(receipt).not.toBeNull();

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(4); // 5 seeded - 1 sold

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("completeCardCheckout is idempotent — re-invoking after it already confirmed the order is a no-op", async () => {
    await seedStock(location.id, 5);
    const session = await posService.openRegister({ registerId: registerWithDevice.id, openingCashCents: 0 });
    const { order } = await createPendingCardOrder({ registerSessionId: session.id });

    await posService.completeCardCheckout(order.id);
    const balanceAfterFirst = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });

    // A duplicate webhook delivery for the same event must not sell the
    // stock a second time.
    await posService.completeCardCheckout(order.id);
    const balanceAfterSecond = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balanceAfterSecond.onHand).toBe(balanceAfterFirst.onHand);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("failCardCheckout cancels the order without touching stock, mirroring a CANCELED terminal checkout", async () => {
    await seedStock(location.id, 5);
    const session = await posService.openRegister({ registerId: registerWithDevice.id, openingCashCents: 0 });
    const { order, payment } = await createPendingCardOrder({ registerSessionId: session.id });

    const balanceBefore = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });

    await posService.failCardCheckout(order.id, "Canceled: TIMED_OUT");

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("CANCELED");

    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("FAILED");
    expect(updatedPayment.failureReason).toBe("Canceled: TIMED_OUT");

    // Nothing was ever reserved (createCardCheckout defers that until
    // success), so canceling must not change onHand/reserved at all.
    const balanceAfter = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balanceAfter.onHand).toBe(balanceBefore.onHand);
    expect(balanceAfter.reserved).toBe(balanceBefore.reserved);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });
});
