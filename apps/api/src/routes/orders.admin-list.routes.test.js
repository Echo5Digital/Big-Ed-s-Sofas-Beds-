const bcrypt = require("bcryptjs");
const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { createApp } = require("../app");
const { signAccessToken, ACCESS_COOKIE } = require("../lib/tokens");

// HTTP-level coverage for GET /admin/orders — previously a hard take:200
// with no skip/q, meaning orders beyond the newest 200 were permanently
// unreachable and unsearchable from the admin Orders page once a store had
// more history than that. This now mirrors customers.service.js's
// pagination/search shape (page/pageSize/total, multi-term AND search).
// Runs against the real dev database (no Prisma mock layer in this repo).
describe("orders.routes — GET /admin/orders", () => {
  const app = createApp();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let managerUser;
  let managerCookie;
  let customerA; // "Jane Doe"
  let customerB; // "John Smith"
  const createdOrderIds = [];

  beforeAll(async () => {
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "MANAGER" } });
    const passwordHash = await bcrypt.hash("TestPassword123!", 10);
    managerUser = await prisma.user.create({
      data: {
        email: `admin-orders-list-manager-${suffix}@example.com`,
        passwordHash,
        firstName: "Orders List",
        lastName: "Manager",
        isActive: true,
        roles: { create: { roleId: managerRole.id } },
      },
    });
    managerCookie = `${ACCESS_COOKIE}=${signAccessToken({ sub: managerUser.id })}`;

    customerA = await prisma.customer.create({
      data: { email: `admin-orders-list-jane-${suffix}@test.local`, firstName: "Jane", lastName: "Doe", channel: "ONLINE" },
    });
    customerB = await prisma.customer.create({
      data: { email: `admin-orders-list-john-${suffix}@test.local`, firstName: "John", lastName: "Smith", channel: "ONLINE" },
    });

    async function createOrder({ orderNumber, customerId }) {
      const order = await prisma.order.create({
        data: { orderNumber, channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "RESERVED", customerId },
      });
      createdOrderIds.push(order.id);
      return order;
    }

    await createOrder({ orderNumber: `BE-ADMINLIST-TEST-${suffix}-1`, customerId: customerA.id });
    await createOrder({ orderNumber: `BE-ADMINLIST-TEST-${suffix}-2`, customerId: customerB.id });
    await createOrder({ orderNumber: `BE-ADMINLIST-TEST-${suffix}-3`, customerId: null });
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await prisma.orderLine.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    await prisma.customer.deleteMany({ where: { id: { in: [customerA.id, customerB.id] } } });
    await prisma.userRole.deleteMany({ where: { userId: managerUser.id } });
    await prisma.user.delete({ where: { id: managerUser.id } });
  });

  it("returns a pagination object alongside orders", async () => {
    const res = await request(app).get("/api/admin/orders?pageSize=5").set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 5 });
    expect(typeof res.body.pagination.total).toBe("number");
  });

  it("finds an order by its exact order number via q", async () => {
    const res = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(`BE-ADMINLIST-TEST-${suffix}-1`)}`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].orderNumber).toBe(`BE-ADMINLIST-TEST-${suffix}-1`);
  });

  it("finds an order by customer first and last name across columns", async () => {
    const res = await request(app).get("/api/admin/orders?q=jane%20doe").set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    const ids = res.body.orders.map((o) => o.id);
    expect(ids).toContain(createdOrderIds[0]);
    expect(ids).not.toContain(createdOrderIds[1]);
  });

  it("finds an order by customer email", async () => {
    const res = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(customerB.email)}`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    const ids = res.body.orders.map((o) => o.id);
    expect(ids).toContain(createdOrderIds[1]);
    expect(ids).not.toContain(createdOrderIds[0]);
  });

  it("a literal % or _ in the search query is treated literally, not as a SQL wildcard", async () => {
    const res = await request(app).get("/api/admin/orders?q=%25%25%25").set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    // An unescaped "%%%" would match every order number (since % matches
    // anything in SQL LIKE) — escaped, it should match none of this test's
    // fixture orders (none contain a literal "%").
    const ids = res.body.orders.map((o) => o.id);
    expect(ids).not.toContain(createdOrderIds[0]);
    expect(ids).not.toContain(createdOrderIds[1]);
    expect(ids).not.toContain(createdOrderIds[2]);
  });

  it("filters by the unified displayStatus alongside channel and q", async () => {
    // Fixture orders are ONLINE/CONFIRMED/UNPAID/RESERVED, which
    // computeOrderDisplayStatus reads as "Ordered" — see orderStatus.service.js.
    const res = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(`BE-ADMINLIST-TEST-${suffix}`)}&channel=ONLINE&displayStatus=Ordered`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(3);
  });

  it("a displayStatus that doesn't match any fixture order excludes them all", async () => {
    const res = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(`BE-ADMINLIST-TEST-${suffix}`)}&displayStatus=Completed`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(0);
  });

  it("filters by paymentStatus=UNPAID (fixture orders) and excludes them under PAID", async () => {
    const unpaid = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(`BE-ADMINLIST-TEST-${suffix}`)}&paymentStatus=UNPAID`)
      .set("Cookie", managerCookie);
    expect(unpaid.status).toBe(200);
    expect(unpaid.body.orders.length).toBe(3);

    const paid = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(`BE-ADMINLIST-TEST-${suffix}`)}&paymentStatus=PAID`)
      .set("Cookie", managerCookie);
    expect(paid.status).toBe(200);
    expect(paid.body.orders.length).toBe(0);
  });

  it("paginates correctly across two pages", async () => {
    const page1 = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(`BE-ADMINLIST-TEST-${suffix}`)}&page=1&pageSize=2`)
      .set("Cookie", managerCookie);
    const page2 = await request(app)
      .get(`/api/admin/orders?q=${encodeURIComponent(`BE-ADMINLIST-TEST-${suffix}`)}&page=2&pageSize=2`)
      .set("Cookie", managerCookie);

    expect(page1.body.orders).toHaveLength(2);
    expect(page2.body.orders).toHaveLength(1);
    expect(page1.body.pagination.total).toBe(3);
    const page1Ids = page1.body.orders.map((o) => o.id);
    const page2Ids = page2.body.orders.map((o) => o.id);
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });
});
