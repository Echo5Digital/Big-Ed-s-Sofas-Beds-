const { prisma } = require("@big-eds/database");
const { hashPin, verifyManagerPin } = require("./posPin");

// Runs against the real dev database (no Prisma mock layer, same convention
// as pos.service.test.js) — creates its own User fixtures and tears them
// down in afterAll.
describe("posPin", () => {
  let manager;
  let cashier;
  const PIN = "4321";

  beforeAll(async () => {
    const managerRole = await prisma.role.findUnique({ where: { name: "MANAGER" } });
    const cashierRole = await prisma.role.findUnique({ where: { name: "CASHIER" } });

    manager = await prisma.user.create({
      data: {
        email: `posPin-manager-${Date.now()}@test.local`,
        passwordHash: "unused",
        firstName: "Pin",
        lastName: "ManagerFixture",
        posPinHash: await hashPin(PIN),
        roles: { create: [{ roleId: managerRole.id }] },
      },
    });
    // Same PIN digits as the manager, deliberately — proves verification
    // is scoped by permission, not just by hash match.
    cashier = await prisma.user.create({
      data: {
        email: `posPin-cashier-${Date.now()}@test.local`,
        passwordHash: "unused",
        firstName: "Pin",
        lastName: "CashierFixture",
        posPinHash: await hashPin(PIN),
        roles: { create: [{ roleId: cashierRole.id }] },
      },
    });
  });

  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { userId: { in: [manager.id, cashier.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [manager.id, cashier.id] } } });
    await prisma.$disconnect();
  });

  it("hashes and verifies a matching PIN for a user holding the required permission", async () => {
    const result = await verifyManagerPin(PIN);
    expect(result).toBe(manager.id);
  });

  it("returns null for a non-matching PIN", async () => {
    const result = await verifyManagerPin("000000");
    expect(result).toBeNull();
  });

  it("never returns a candidate who lacks the required permission, even with a matching hash", async () => {
    // Deactivate the manager so only the cashier (same PIN, wrong role) remains.
    await prisma.user.update({ where: { id: manager.id }, data: { isActive: false } });
    const result = await verifyManagerPin(PIN);
    expect(result).toBeNull();
    await prisma.user.update({ where: { id: manager.id }, data: { isActive: true } });
  });
});
