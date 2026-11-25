const jwt = require("jsonwebtoken");
const { env } = require("./env");

function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: `${env.accessTokenTtlMinutes}m`,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

const ACCESS_COOKIE = "big_eds_access_token";
const REFRESH_COOKIE = "big_eds_refresh_token";

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    maxAge: maxAgeMs,
    path: "/",
    // Chrome's third-party cookie phase-out (already enforced in Incognito,
    // rolling out generally) silently drops or isolates a SameSite=None
    // cookie set across sites — e.g. the Vercel-hosted frontends calling the
    // Render-hosted API — unless it also carries Partitioned (the CHIPS
    // spec). Without this, login itself succeeds (the Set-Cookie response is
    // sent) but the cookie never comes back on the very next request, which
    // is exactly the "login works, then immediately looks logged out" bug.
    // Only meaningful alongside SameSite=None; harmless to omit under Lax
    // (same-site local dev), so it's gated on the same condition that
    // already picks None over Lax.
    partitioned: env.cookieSameSite === "none",
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  cookieOptions,
};
