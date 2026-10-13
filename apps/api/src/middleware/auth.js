const { prisma } = require("@big-eds/database");
const { verifyAccessToken, ACCESS_COOKIE } = require("../lib/tokens");
const { UnauthorizedError, ForbiddenError } = require("../lib/errors");
const { asyncHandler } = require("./asyncHandler");

// Every staff endpoint must call requireAuth; there is no implicit trust of
// client-sent role/user data. The JWT only carries the user id — permissions
// are re-read from the database on every request so revocation/role changes
// take effect immediately rather than waiting for token expiry.
const requireAuth = asyncHandler(async function requireAuth(req, res, next) {
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
  const permissions = new Set(
    user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key))
  );

  req.user = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: roleNames,
    permissions,
  };

  next();
});

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

module.exports = { requireAuth, requirePermission, requireRole };
