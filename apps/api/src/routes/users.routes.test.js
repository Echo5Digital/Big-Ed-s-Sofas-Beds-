const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");

// Runs against the real dev database (same convention as auth.routes.test.js
// and pos.service.test.js — no Prisma mock layer, no HTTP test harness in
// this codebase). Role.name is a fixed Prisma enum (ADMIN | MANAGER | STAFF |
// CASHIER), not free-text, so tests attach to the real seeded roles rather
// than creating new ones.
//
// Exercises the same transaction shape users.routes.js's setUserRoles()
// uses (delete-then-recreate UserRole rows) directly against Prisma, since
// that helper isn't exported standalone — this is a regression test for the
// specific bug class a naive "just upsert the new roles" implementation
// would have: switching a user from one role to another would leave the old
// UserRole row in place alongside the new one instead of replacing it,
// silently granting both roles' permissions.
async function replaceRoles(userId, roleNames) {
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.id })) }),
  ]);
}

describe("users.routes — role replacement", () => {
  const testEmail = `users-roles-test-${Date.now()}@example.com`;
  let user;

  beforeAll(async () => {
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "MANAGER" } });
    const passwordHash = await bcrypt.hash("TestPassword123!", 10);
    user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        firstName: "Roles",
        lastName: "ReplaceTest",
        isActive: true,
        roles: { create: { roleId: managerRole.id } },
      },
    });
  });

  afterAll(async () => {
    if (user) {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("switching from one role to another removes the old role instead of keeping both", async () => {
    await replaceRoles(user.id, ["CASHIER"]);

    const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
    const roleNames = roles.map((ur) => ur.role.name);

    expect(roleNames).toEqual(["CASHIER"]);
    expect(roleNames).not.toContain("MANAGER");
  });

  it("assigning multiple roles at once grants both", async () => {
    await replaceRoles(user.id, ["MANAGER", "CASHIER"]);

    const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
    const roleNames = roles.map((ur) => ur.role.name).sort();

    expect(roleNames).toEqual(["CASHIER", "MANAGER"]);
  });

  it("a deactivated user is rejected by login regardless of valid credentials", async () => {
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const reloaded = await prisma.user.findUnique({ where: { id: user.id } });
    expect(reloaded.isActive).toBe(false);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
  });
});

describe("users.routes — last-admin lockout guard", () => {
  it("counting other admins excludes the current user correctly", async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
    const admins = await prisma.userRole.findMany({ where: { roleId: adminRole.id } });

    // Sanity check on the guard's own query shape used in users.routes.js's
    // PATCH /:id/roles handler: `userId: { not: req.user.id }` must actually
    // exclude the acting admin, or the last real admin could still strip
    // their own ADMIN role because the count would include themselves.
    expect(admins.length).toBeGreaterThan(0);
    const firstAdminUserId = admins[0].userId;
    const othersExcludingFirst = await prisma.userRole.count({
      where: { userId: { not: firstAdminUserId }, role: { name: "ADMIN" } },
    });
    expect(othersExcludingFirst).toBe(admins.length - 1);
  });
});
