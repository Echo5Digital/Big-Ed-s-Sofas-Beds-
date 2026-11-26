const bcrypt = require("bcryptjs");
const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { createApp } = require("../app");
const { signAccessToken, ACCESS_COOKIE } = require("../lib/tokens");
const { hashPin } = require("../lib/posPin");

// HTTP-level coverage for POST /pos/verify-manager-pin — the live-check
// endpoint TenderModal.jsx calls as a cashier finishes typing a manager PIN,
// so a wrong PIN surfaces at the input box instead of only after Confirm
// Payment re-runs the whole sale. Pure verify: must never mutate anything
// (no audit log entry, no order/session side effects) regardless of
// outcome — that's still owned exclusively by ringSale's own PIN check on
// an actual denied sale. Runs against the real dev database, no mocks.
describe("pos.routes — POST /pos/verify-manager-pin", () => {
  const app = createApp();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const MANAGER_PIN = "4321";
  let cashierUser;
  let cashierCookie;
  let manager;

  beforeAll(async () => {
    const cashierRole = await prisma.role.findUniqueOrThrow({ where: { name: "CASHIER" } });
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "MANAGER" } });
    const passwordHash = await bcrypt.hash("TestPassword123!", 10);

    cashierUser = await prisma.user.create({
      data: {
        email: `pos-verify-pin-cashier-${suffix}@example.com`,
        passwordHash,
        firstName: "Verify Pin",
        lastName: "Cashier",
        isActive: true,
        roles: { create: { roleId: cashierRole.id } },
      },
    });
    cashierCookie = `${ACCESS_COOKIE}=${signAccessToken({ sub: cashierUser.id })}`;

    manager = await prisma.user.create({
      data: {
        email: `pos-verify-pin-manager-${suffix}@example.com`,
        passwordHash: "unused",
        firstName: "Verify Pin",
        lastName: "Manager",
        isActive: true,
        posPinHash: await hashPin(MANAGER_PIN),
        roles: { create: { roleId: managerRole.id } },
      },
    });
  });

  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { userId: { in: [cashierUser.id, manager.id] } } });
    await prisma.user.delete({ where: { id: cashierUser.id } });
    await prisma.user.delete({ where: { id: manager.id } });
  });

  it("reports valid:true for a real manager PIN, with no audit log entry", async () => {
    const res = await request(app)
      .post("/api/pos/verify-manager-pin")
      .set("Cookie", cashierCookie)
      .send({ approverPin: MANAGER_PIN });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true });

    const auditEntries = await prisma.auditLog.count({ where: { userId: cashierUser.id } });
    expect(auditEntries).toBe(0);
  });

  it("reports valid:false for a wrong PIN, with no audit log entry", async () => {
    const res = await request(app)
      .post("/api/pos/verify-manager-pin")
      .set("Cookie", cashierCookie)
      .send({ approverPin: "000000" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: false });

    const auditEntries = await prisma.auditLog.count({ where: { userId: cashierUser.id } });
    expect(auditEntries).toBe(0);
  });

  it("rejects a malformed PIN with a validation error", async () => {
    const res = await request(app)
      .post("/api/pos/verify-manager-pin")
      .set("Cookie", cashierCookie)
      .send({ approverPin: "abc" });

    expect(res.status).toBe(422);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/pos/verify-manager-pin").send({ approverPin: MANAGER_PIN });

    expect(res.status).toBe(401);
  });
});
