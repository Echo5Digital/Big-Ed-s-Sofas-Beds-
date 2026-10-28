const jwt = require("jsonwebtoken");
const { env } = require("./env");
const { cookieOptions } = require("./tokens");

// Customer sessions reuse the staff JWT secrets but are kept strictly apart in
// two ways: their own cookie names, and a distinct `aud` claim that
// verifyCustomer* insists on. Staff tokens (no `aud`) therefore fail customer
// verification, and a customer token placed in the staff cookie would resolve
// to a customer id that matches no User row, so requireAuth rejects it too.
const CUSTOMER_AUDIENCE = "customer";
const CUSTOMER_ACCESS_COOKIE = "big_eds_customer_access_token";
const CUSTOMER_REFRESH_COOKIE = "big_eds_customer_refresh_token";

function signCustomerAccessToken(customerId) {
  return jwt.sign({ sub: customerId }, env.jwtAccessSecret, {
    expiresIn: `${env.accessTokenTtlMinutes}m`,
    audience: CUSTOMER_AUDIENCE,
  });
}

function signCustomerRefreshToken(customerId) {
  return jwt.sign({ sub: customerId }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
    audience: CUSTOMER_AUDIENCE,
  });
}

function verifyCustomerAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret, { audience: CUSTOMER_AUDIENCE });
}

function verifyCustomerRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret, { audience: CUSTOMER_AUDIENCE });
}

function setCustomerSessionCookies(res, customerId) {
  res.cookie(
    CUSTOMER_ACCESS_COOKIE,
    signCustomerAccessToken(customerId),
    cookieOptions(env.accessTokenTtlMinutes * 60 * 1000)
  );
  res.cookie(
    CUSTOMER_REFRESH_COOKIE,
    signCustomerRefreshToken(customerId),
    cookieOptions(env.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
  );
}

function clearCustomerSessionCookies(res) {
  // Must match the attributes (secure, sameSite) of the original Set-Cookie or
  // some browsers won't actually clear it — same reasoning as staff /logout.
  const clearOptions = { path: "/", secure: env.cookieSecure, sameSite: env.cookieSameSite };
  res.clearCookie(CUSTOMER_ACCESS_COOKIE, clearOptions);
  res.clearCookie(CUSTOMER_REFRESH_COOKIE, clearOptions);
}

module.exports = {
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  signCustomerAccessToken,
  verifyCustomerAccessToken,
  verifyCustomerRefreshToken,
  setCustomerSessionCookies,
  clearCustomerSessionCookies,
};
