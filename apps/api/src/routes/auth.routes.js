const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { prisma } = require("@big-eds/database");
const { loginSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { UnauthorizedError } = require("../lib/errors");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  cookieOptions,
} = require("../lib/tokens");
const { env } = require("../lib/env");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many login attempts. Try again later." } },
});

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles.map((ur) => ur.role.name),
  };
}

async function loadUserWithRoles(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
}

router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const accessToken = signAccessToken({ sub: user.id });
    const refreshToken = signRefreshToken({ sub: user.id });

    res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(env.accessTokenTtlMinutes * 60 * 1000));
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(env.refreshTokenTtlDays * 24 * 60 * 60 * 1000));

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
      },
    });

    res.json({ user: toPublicUser(user) });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedError("No refresh token");
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = await loadUserWithRoles(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Account not found or disabled");
    }

    const accessToken = signAccessToken({ sub: user.id });
    res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(env.accessTokenTtlMinutes * 60 * 1000));

    res.json({ user: toPublicUser(user) });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    // clearCookie must be called with matching attributes (secure, sameSite)
    // to the original Set-Cookie, or some browsers won't actually clear it.
    const clearOptions = { path: "/", secure: env.cookieSecure, sameSite: env.cookieSameSite };
    res.clearCookie(ACCESS_COOKIE, clearOptions);
    res.clearCookie(REFRESH_COOKIE, clearOptions);
    res.json({ success: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        roles: req.user.roles,
        permissions: Array.from(req.user.permissions),
      },
    });
  })
);

module.exports = router;
