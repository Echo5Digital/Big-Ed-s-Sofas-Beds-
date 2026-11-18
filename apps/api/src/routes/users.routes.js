const express = require("express");
const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");
const {
  userCreateSchema,
  userUpdateSchema,
  userRolesUpdateSchema,
  userPinUpdateSchema,
} = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError, ConflictError } = require("../lib/errors");
const { listRegisteredCustomers, deleteRegisteredCustomer } = require("../services/customers.service");
const { nextEmployeeId, prefixForRoles } = require("../lib/employeeId");
const { hashPin } = require("../lib/posPin");

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission("users:manage"));

const ROLE_INCLUDE = { roles: { include: { role: true } } };

// A SUPER_ADMIN account is invisible to every other user on this router,
// including other admins — only the Super Admin viewing their own row can
// see or act on it. Used both to filter the list (GET /) and to guard every
// by-id route (PATCH /:id, /:id/roles, /:id/pin) against an admin who
// already knows/guessed the id. Always a NotFoundError, never Forbidden —
// a 403 would itself leak that the account exists.
function isHiddenFromCaller(targetUser, req) {
  if (req.params.id === req.user.id) return false;
  return targetUser.roles.some((ur) => ur.role.name === "SUPER_ADMIN");
}

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
    employeeId: user.employeeId,
    roles: user.roles.map((ur) => ur.role.name),
    posPinUpdatedAt: user.posPinUpdatedAt ?? null,
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
      // Every non-Super-Admin user, plus the caller's own row if *they*
      // are the Super Admin — so Sony sees Sony, but no one else ever does.
      where: {
        OR: [{ roles: { none: { role: { name: "SUPER_ADMIN" } } } }, { id: req.user.id }],
      },
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

router.delete(
  "/customers/:id",
  asyncHandler(async (req, res) => {
    const { id, orderCount } = await deleteRegisteredCustomer(req.params.id);

    // The audit entry records who removed which customer and when, but
    // deliberately not the customer's email or name: the point of the delete is
    // that their personal details are gone from the database, and this row would
    // otherwise keep them.
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "customer.delete",
        entityType: "Customer",
        entityId: id,
        metadata: { orderCount },
      },
    });

    res.json({ success: true, orderCount });
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
      const employeeId = await nextEmployeeId(roleNames, tx);
      const created = await tx.user.create({
        data: { email, passwordHash, firstName, lastName, employeeId },
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
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: ROLE_INCLUDE });
    if (!target || isHiddenFromCaller(target, req)) throw new NotFoundError("User not found");

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
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: ROLE_INCLUDE });
    if (!target || isHiddenFromCaller(target, req)) throw new NotFoundError("User not found");

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

    // Only regenerate the employee id when the role change actually moves it
    // to a different prefix (e.g. Cashier -> Manager, or Manager -> Admin-only
    // which clears it) — re-saving the same role set, or changing roles in a
    // way that doesn't change which prefix wins, must not burn a new sequence
    // number on every save.
    const currentPrefix = target.employeeId ? target.employeeId.slice(0, 3) : null;
    const nextPrefix = prefixForRoles(roleNames);

    const user = await prisma.$transaction(async (tx) => {
      const employeeId = nextPrefix === currentPrefix ? target.employeeId : await nextEmployeeId(roleNames, tx);
      await setUserRoles(tx, req.params.id, roleNames);
      return tx.user.update({ where: { id: req.params.id }, data: { employeeId }, include: ROLE_INCLUDE });
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

// Sets/resets a user's POS discount-override PIN — a separate credential
// from their login password (see lib/posPin.js). No "confirm PIN" field:
// same low-stakes-reset simplicity as the "Initial password" field on user
// creation — an admin can just reset again if mistyped. Never echoes the
// PIN or its hash back, and never logs the PIN itself in the audit trail.
// A PIN only ever means something for whoever verifyManagerPin (posPin.js)
// is willing to accept it from — gated on the same pos:register:approve-
// reopen permission, not a hardcoded role list, so this stays correct if
// that permission's role grants ever change.
router.patch(
  "/:id/pin",
  validateBody(userPinUpdateSchema),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!target || isHiddenFromCaller(target, req)) throw new NotFoundError("User not found");

    const canApprove = target.roles.some((ur) =>
      ur.role.permissions.some((rp) => rp.permission.key === "pos:register:approve-reopen")
    );
    if (!canApprove) {
      throw new ConflictError("A POS discount PIN can only be set for Manager or Admin accounts");
    }

    const posPinHash = await hashPin(req.body.pin);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { posPinHash, posPinUpdatedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "user.pin.reset",
        entityType: "User",
        entityId: target.id,
      },
    });

    res.json({ success: true });
  })
);

// Sales credited to this user (as SALESMAN or MANAGER) — backs the admin
// Users drill-down page.
router.get(
  "/:id/sales-attribution",
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: ROLE_INCLUDE });
    if (!target || isHiddenFromCaller(target, req)) throw new NotFoundError("User not found");

    const attributions = await prisma.orderSalesAttribution.findMany({
      where: { userId: req.params.id },
      include: {
        order: { select: { id: true, orderNumber: true, totalCents: true, createdAt: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({
      attributions: attributions.map((a) => ({
        orderId: a.order.id,
        orderNumber: a.order.orderNumber,
        totalCents: a.order.totalCents,
        creditedAmountCents: Math.round((a.order.totalCents * a.splitPercent) / 100),
        splitPercent: a.splitPercent,
        role: a.role,
        orderStatus: a.order.status,
        createdAt: a.order.createdAt,
      })),
    });
  })
);

// Discounts this user approved via a POS PIN override — backs the admin
// Users drill-down page.
router.get(
  "/:id/discount-approvals",
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: ROLE_INCLUDE });
    if (!target || isHiddenFromCaller(target, req)) throw new NotFoundError("User not found");

    const orders = await prisma.order.findMany({
      where: { discountApprovedById: req.params.id },
      select: {
        id: true,
        orderNumber: true,
        discountCents: true,
        discountPercent: true,
        subtotalCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ approvals: orders });
  })
);

module.exports = router;
