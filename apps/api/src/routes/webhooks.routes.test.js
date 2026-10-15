const { prisma } = require("@big-eds/database");
const { handlePaymentSucceeded, handlePaymentFailed } = require("./webhooks.routes");
const inventoryService = require("../services/inventory.service");

// Runs against the real dev database (same convention as pos.service.test.js
// — no Prisma mock layer). Exercises the webhook *handlers* directly rather
// than over HTTP: signature verification and raw-body parsing are Express/
// Stripe-SDK plumbing, already covered by Stripe's own test suite — what
// this repo owns and must verify is the idempotency + stock-reconciliation
// behavior once an event is trusted.
describe("webhooks.routes — Stripe payment handlers", () => {
  let location;
  let category;
  let product;
  let variant;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "Webhook Test Category", slug: `webhook-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "Webhook Test Warehouse", type: "WAREHOUSE" },
    });
    product = await prisma.product.create({
      data: { name: "Webhook Test Sofa", slug: `webhook-test-sofa-${Date.now()}`, status: "ACTIVE", categoryId: category.id },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `WEBHOOK-TEST-${Date.now()}`, name: "Default", priceCents: 10000 },
    });
    await prisma.stockBalance.create({
      data: { variantId: variant.id, locationId: location.id, onHand: 5, reserved: 0, quarantined: 0 },
    });
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { OR: [{ lines: { some: { variantId: variant.id } } }, { reservations: { some: { variantId: variant.id } } }] },
    });
    for (const order of orders) {
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.reservation.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    await prisma.stockMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.reservation.deleteMany({ where: { variantId: variant.id } });
    await prisma.stockBalance.deleteMany({ where: { variantId: variant.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
  });

  async function createOrderWithReservation() {
    const order = await prisma.order.create({
      data: {
        orderNumber: `WEBHOOK-TEST-ORDER-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        channel: "ONLINE",
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        fulfillmentStatus: "RESERVED",
        subtotalCents: 10000,
        totalCents: 10000,
      },
    });
    const reservation = await inventoryService.reserveStock({
      variantId: variant.id,
      locationId: location.id,
      quantity: 1,
      orderId: order.id,
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        method: "CARD",
        status: "PENDING",
        amountCents: 10000,
        providerName: "stripe",
        providerRef: `pi_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      },
    });
    return { order, reservation, payment };
  }

  it("payment_intent.succeeded converts the reservation to a sale and marks the order paid", async () => {
    const { order, reservation, payment } = await createOrderWithReservation();

    await handlePaymentSucceeded({ id: payment.providerRef });

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder.paymentStatus).toBe("PAID");
    expect(updatedOrder.fulfillmentStatus).toBe("READY");

    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("SUCCEEDED");

    const updatedReservation = await prisma.reservation.findUnique({ where: { id: reservation.id } });
    expect(updatedReservation.status).toBe("CONVERTED");

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.reserved).toBe(0);
  });

  it("payment_intent.payment_failed releases the reservation and cancels the order", async () => {
    const { order, reservation, payment } = await createOrderWithReservation();

    await handlePaymentFailed({ id: payment.providerRef, last_payment_error: { message: "Your card was declined." } });

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("CANCELED");

    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("FAILED");
    expect(updatedPayment.failureReason).toBe("Your card was declined.");

    const updatedReservation = await prisma.reservation.findUnique({ where: { id: reservation.id } });
    expect(updatedReservation.status).toBe("RELEASED");

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.reserved).toBe(0);
  });

  it("is a no-op when no Payment matches the PaymentIntent id (e.g. unrelated/test event)", async () => {
    await expect(handlePaymentSucceeded({ id: "pi_does_not_exist" })).resolves.toBeUndefined();
    await expect(handlePaymentFailed({ id: "pi_does_not_exist" })).resolves.toBeUndefined();
  });

  it("ProviderEvent.eventId uniqueness makes a duplicate webhook delivery a no-op at the database layer", async () => {
    const eventId = `evt_test_${Date.now()}`;
    await prisma.providerEvent.create({
      data: { providerName: "stripe", eventId, eventType: "payment_intent.succeeded", payload: { id: eventId } },
    });

    await expect(
      prisma.providerEvent.create({
        data: { providerName: "stripe", eventId, eventType: "payment_intent.succeeded", payload: { id: eventId } },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    await prisma.providerEvent.delete({ where: { eventId } });
  });
});
