const { prisma } = require("@big-eds/database");
const { verifyAccessToken, ACCESS_COOKIE } = require("../lib/tokens");
const { UnauthorizedError, ForbiddenError } = require("../lib/errors");
const { asyncHandler } = require("./asyncHandler");

// Cashier is POS-only — mirrors apps/admin/lib/hooks/useAuth.js's
// isCashierOnlyUser exactly (Cashier plus no other role is blocked; Cashier
// plus e.g. Manager is unaffected). That admin-side check only stops the
// admin SPA's own pages from rendering; without this server-side twin, a
// Cashier's own valid session cookie could still pull admin data (full order
// PII, inventory, cost prices — all permissions CASHIER legitimately holds
// for POS purposes) directly from the API, bypassing the admin UI entirely.
function isCashierOnlyRole(roleNames) {
  return roleNames.length === 1 && roleNames[0] === "CASHIER";
}

// Every staff endpoint must call requireAuth; there is no implicit trust of
// client-sent role/user data. The JWT only carries the user id — permissions
// are re-read from the database on every request so revocation/role changes
// take effect immediately rather than waiting for token expiry.
//
// Pass { allowCashierOnly: true } only for routes a Cashier is meant to use
// directly (currently just pos.routes.js) — every other caller keeps the
// default block.
function requireAuth({ allowCashierOnly = false } = {}) {
  return asyncHandler(async function requireAuthMiddleware(req, res, next) {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) {
      throw new UnauthorizedError("Not authenticated");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired session");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Account not found or disabled");
    }

    const roleNames = user.roles.map((ur) => ur.role.name);
    if (!allowCashierOnly && isCashierOnlyRole(roleNames)) {
      throw new ForbiddenError("Cashier accounts can't access the admin dashboard");
    }

    const permissions = new Set(
      user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key))
    );

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      roles: roleNames,
      permissions,
    };

    next();
  });
}

function requirePermission(permissionKey) {
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.user?.permissions?.has(permissionKey)) {
      return next(new ForbiddenError(`Missing required permission: ${permissionKey}`));
    }
    next();
  };
}

function requireRole(...roleNames) {
  return function requireRoleMiddleware(req, res, next) {
    const hasRole = req.user?.roles?.some((r) => roleNames.includes(r));
    if (!hasRole) {
      return next(new ForbiddenError(`Requires role: ${roleNames.join(" or ")}`));
    }
    next();
  };
}

module.exports = {
  // Default instance — blocks Cashier-only sessions. Used by every staff
  // route except pos.routes.js.
  requireAuth: requireAuth(),
  // Opt-in for the one router a Cashier is meant to call directly.
  requireAuthAllowCashier: requireAuth({ allowCashierOnly: true }),
  requirePermission,
  requireRole,
};
