const bcrypt = require("bcryptjs");
const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { createApp } = require("../app");
const { signAccessToken, ACCESS_COOKIE } = require("../lib/tokens");

// HTTP-level coverage for PATCH /api/admin/orders/:id/status — the one new
// staff-facing mutation this feature adds (see
// apps/api/src/services/orderStatus.service.js and
// docs/workflows/order-lifecycle.md's "Unified display status" section).
// Runs against the real dev database (no Prisma mock layer in this repo).
// Auth is exercised for real (a genuine User row + seeded Role/Permission
// rows, a real JWT signed the same way login does) rather than bypassing
// requireAuth/requirePermission, so a regression in the permission gate
// itself would actually be caught here.
describe("orders.routes — PATCH /admin/orders/:id/status", () => {
  const app = createApp();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let managerRole;
  let salesmanRole;
  let managerUser;
  let salesmanUser;
  let managerCookie;
  let salesmanCookie;
  const createdOrderIds = [];

  beforeAll(async () => {
    managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "MANAGER" } });
    salesmanRole = await prisma.role.findUniqueOrThrow({ where: { name: "SALESMAN" } });

    const passwordHash = await bcrypt.hash("TestPassword123!", 10);
    managerUser = await prisma.user.create({
      data: {
        email: `order-status-manager-${suffix}@example.com`,
        passwordHash,
        firstName: "Order Status",
        lastName: "Manager",
        isActive: true,
        roles: { create: { roleId: managerRole.id } },
      },
    });
    salesmanUser = await prisma.user.create({
      data: {
        email: `order-status-salesman-${suffix}@example.com`,
        passwordHash,
        firstName: "Order Status",
        lastName: "Salesman",
        isActive: true,
        roles: { create: { roleId: salesmanRole.id } },
      },
    });

    // Minted directly (same signAccessToken real login uses) rather than a
    // round trip through POST /auth/login, to avoid that route's own
    // rate limiter across this file's several tests.
    managerCookie = `${ACCESS_COOKIE}=${signAccessToken({ sub: managerUser.id })}`;
    salesmanCookie = `${ACCESS_COOKIE}=${signAccessToken({ sub: salesmanUser.id })}`;
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await prisma.statusHistory.deleteMany({ where: { orderId: id } });
      await prisma.orderLine.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await prisma.userRole.deleteMany({ where: { userId: { in: [managerUser.id, salesmanUser.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [managerUser.id, salesmanUser.id] } } });
  });

  async function createOrder({ channel, status = "CONFIRMED", paymentStatus, fulfillmentStatus, fulfillmentMethod = "PICKUP" }) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `BE-STATUS-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        channel,
        status,
        paymentStatus,
        fulfillmentStatus,
        fulfillmentMethod,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  it("a manager can advance an online order through Processing", async () => {
    const order = await createOrder({ channel: "ONLINE", paymentStatus: "UNPAID", fulfillmentStatus: "RESERVED" });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Processing" });

    expect(res.status).toBe(200);
    expect(res.body.order.fulfillmentStatus).toBe("PROCESSING");
    expect(res.body.order.displayStatus).toBe("Processing");

    const history = await prisma.statusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ field: "displayStatus", fromValue: "Ordered", toValue: "Processing" });
  });

  it("Completed resolves to DELIVERED for a DELIVERY order", async () => {
    const order = await createOrder({
      channel: "ONLINE",
      paymentStatus: "PAID",
      fulfillmentStatus: "READY",
      fulfillmentMethod: "DELIVERY",
    });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Completed" });

    expect(res.status).toBe(200);
    expect(res.body.order.fulfillmentStatus).toBe("DELIVERED");
    expect(res.body.order.displayStatus).toBe("Completed");
  });

  it("rejects Processing on a POS order (not a legal target for that channel)", async () => {
    const order = await createOrder({ channel: "POS", paymentStatus: "PAID", fulfillmentStatus: "RESERVED" });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Processing" });

    expect(res.status).toBe(409);
  });

  it("rejects changing the status of a canceled order", async () => {
    const order = await createOrder({ channel: "ONLINE", status: "CANCELED", paymentStatus: "UNPAID", fulfillmentStatus: "UNALLOCATED" });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Ready" });

    expect(res.status).toBe(409);
  });

  it("returns 404 for a nonexistent order", async () => {
    const res = await request(app)
      .patch("/api/admin/orders/00000000-0000-4000-8000-000000000000/status")
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Ready" });

    expect(res.status).toBe(404);
  });

  it("rejects a salesman (no orders:write permission) with 403", async () => {
    const order = await createOrder({ channel: "ONLINE", paymentStatus: "UNPAID", fulfillmentStatus: "RESERVED" });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", salesmanCookie)
      .send({ displayStatus: "Processing" });

    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const order = await createOrder({ channel: "ONLINE", paymentStatus: "UNPAID", fulfillmentStatus: "RESERVED" });

    const res = await request(app).patch(`/api/admin/orders/${order.id}/status`).send({ displayStatus: "Processing" });

    expect(res.status).toBe(401);
  });

  it("rejects a request body naming Draft or Canceled (display-only, not a valid target)", async () => {
    const order = await createOrder({ channel: "POS", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "RESERVED" });

    const draftRes = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Draft" });
    expect(draftRes.status).toBe(422);

    const canceledRes = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Canceled" });
    expect(canceledRes.status).toBe(422);
  });

  it("POS Ordered marks paymentStatus PAID and fulfillmentStatus RESERVED (settles a deposit's fulfillment track)", async () => {
    const order = await createOrder({ channel: "POS", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "RESERVED" });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Ordered" });

    expect(res.status).toBe(200);
    expect(res.body.order.paymentStatus).toBe("PAID");
    expect(res.body.order.fulfillmentStatus).toBe("RESERVED");
    expect(res.body.order.displayStatus).toBe("Ordered");
  });

  // Backs the storefront's 7-day "Request Return" window on My Orders
  // (apps/storefront/components/account/OrdersSection.jsx) — completedAt
  // must be stamped on the first transition into Completed, and must never
  // move on any later status change, or the window would silently reset.
  it("stamps completedAt on first transition to Completed, and never overwrites it afterward", async () => {
    const order = await createOrder({
      channel: "ONLINE",
      paymentStatus: "PAID",
      fulfillmentStatus: "READY",
      fulfillmentMethod: "PICKUP",
    });
    expect(order.completedAt).toBeNull();

    const firstRes = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Completed" });
    expect(firstRes.status).toBe(200);

    const afterFirst = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterFirst.completedAt).not.toBeNull();
    const firstCompletedAt = afterFirst.completedAt.getTime();

    // Re-saving "Completed" (the only other legal target for a PICKUP order
    // at this fulfillmentStatus is itself) must not move completedAt forward.
    const secondRes = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set("Cookie", managerCookie)
      .send({ displayStatus: "Completed" });
    expect(secondRes.status).toBe(200);

    const afterSecond = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterSecond.completedAt.getTime()).toBe(firstCompletedAt);
  });
});
