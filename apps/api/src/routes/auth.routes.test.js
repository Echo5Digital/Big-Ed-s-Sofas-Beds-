const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");

// Runs against the real dev database (same convention as pos.service.test.js
// and webhooks.routes.test.js — no Prisma mock layer). Regression test for a
// bug where POST /auth/login and POST /auth/refresh returned a thinner user
// shape than GET /auth/me: login omitted `permissions` entirely, so the
// admin/POS clients' hasPermission() checks silently evaluated false for
// every permission immediately after login (sidebar nav items missing,
// POS "Not authorized" flash) until a later /auth/me refetch repaired it.
//
// Attaches the test user to the real, seeded CASHIER role rather than
// creating a new role — Role.name is a fixed Prisma enum (ADMIN | MANAGER |
// STAFF | CASHIER), not a free-text field.
describe("auth.routes — login/refresh user shape", () => {
  const testEmail = `auth-shape-test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";
  let cashierRole;
  let user;

  beforeAll(async () => {
    cashierRole = await prisma.role.findUniqueOrThrow({ where: { name: "CASHIER" } });

    const passwordHash = await bcrypt.hash(testPassword, 10);
    user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        firstName: "Auth",
        lastName: "ShapeTest",
        isActive: true,
        roles: { create: { roleId: cashierRole.id } },
      },
    });
  });

  afterAll(async () => {
    if (user) {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("login query includes permissions so toPublicUser can populate them", async () => {
    const loaded = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    const permissionKeys = loaded.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key));
    expect(permissionKeys).toContain("pos:sell");
  });

  it("refresh's loadUserWithRoles query includes permissions", async () => {
    const loaded = await prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    const permissionKeys = loaded.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key));
    expect(permissionKeys).toContain("pos:sell");
  });
});
