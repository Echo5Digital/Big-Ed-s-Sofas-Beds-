const express = require("express");
const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");
const { userCreateSchema, userUpdateSchema, userRolesUpdateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const { listRegisteredCustomers } = require("../services/customers.service");

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission("users:manage"));

const ROLE_INCLUDE = { roles: { include: { role: true } } };

// Mirrors auth.routes.js's toPublicUser shape (roles as name strings) plus
// isActive/createdAt, which that function omits since /auth/me never needs
// them. Never includes passwordHash.
function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    roles: user.roles.map((ur) => ur.role.name),
    createdAt: user.createdAt,
  };
}

// Replaces a user's full role set in one transaction (delete-then-recreate)
// rather than only upserting the new roles, so removing a role actually
// takes it away instead of leaving the old UserRole row behind alongside it.
async function setUserRoles(tx, userId, roleNames) {
  const roles = await tx.role.findMany({ where: { name: { in: roleNames } } });
  if (roles.length !== roleNames.length) {
    throw new ConflictError("One or more roles were not recognized");
  }

  await tx.userRole.deleteMany({ where: { userId } });
  await tx.userRole.createMany({
    data: roles.map((role) => ({ userId, roleId: role.id })),
  });
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      include: ROLE_INCLUDE,
      orderBy: [{ isActive: "desc" }, { firstName: "asc" }, { lastName: "asc" }],
    });
    res.json({ users: users.map(serializeUser) });
  })
);

// Storefront customers who registered an account (read-only). Lives under
// /users so it shares this router's requireAuth + users:manage guard — these
// are personal details, so no broader permission can see them.
router.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = req.query;
    // A repeated query param arrives as an array; only a plain string is a search.
    const result = await listRegisteredCustomers({ q: typeof q === "string" ? q : undefined, page, pageSize });
    res.json(result);
  })
);

router.post(
  "/",
  validateBody(userCreateSchema),
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, roleNames } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, firstName, lastName },
      });
      await setUserRoles(tx, created.id, roleNames);
      return tx.user.findUnique({ where: { id: created.id }, include: ROLE_INCLUDE });
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "user.create",
        entityType: "User",
        entityId: user.id,
        metadata: { email, roleNames },
      },
    });

    res.status(201).json({ user: serializeUser(user) });
  })
);

router.patch(
  "/:id",
  validateBody(userUpdateSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new NotFoundError("User not found");

    // A user deactivating their own only account would otherwise lock
    // themselves out with no other admin able to sign in and undo it.
    if (req.body.isActive === false && req.params.id === req.user.id) {
      throw new ConflictError("You can't deactivate your own account");
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      include: ROLE_INCLUDE,
    });

    if (typeof req.body.isActive === "boolean") {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: req.body.isActive ? "user.activate" : "user.deactivate",
          entityType: "User",
          entityId: updated.id,
        },
      });
    }

    res.json({ user: serializeUser(updated) });
  })
);

router.patch(
  "/:id/roles",
  validateBody(userRolesUpdateSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new NotFoundError("User not found");

    const { roleNames } = req.body;

    // A user removing ADMIN from their own only admin account would
    // otherwise lock every admin out of user management with no way back in.
    if (req.params.id === req.user.id && !roleNames.includes("ADMIN") && req.user.roles.includes("ADMIN")) {
      const otherAdminCount = await prisma.userRole.count({
        where: { userId: { not: req.user.id }, role: { name: "ADMIN" } },
      });
      if (otherAdminCount === 0) {
        throw new ConflictError("You can't remove your own Admin role — no other admin account exists");
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      await setUserRoles(tx, req.params.id, roleNames);
      return tx.user.findUnique({ where: { id: req.params.id }, include: ROLE_INCLUDE });
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "user.roles.update",
        entityType: "User",
        entityId: user.id,
        metadata: { roleNames },
      },
    });

    res.json({ user: serializeUser(user) });
  })
);

module.exports = router;
