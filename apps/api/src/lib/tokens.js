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
