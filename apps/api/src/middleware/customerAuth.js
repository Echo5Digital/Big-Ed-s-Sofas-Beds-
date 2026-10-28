const { UnauthorizedError } = require("../lib/errors");
const { CUSTOMER_ACCESS_COOKIE, verifyCustomerAccessToken } = require("../lib/customerTokens");
const { getSignedInCustomer } = require("../services/customerAuth.service");
const { asyncHandler } = require("./asyncHandler");

// Storefront counterpart of requireAuth. Reads only the customer cookie and
// only accepts customer-audience tokens, so it can never be satisfied by a
// staff session — and requireAuth can never be satisfied by this one.
const requireCustomer = asyncHandler(async function requireCustomer(req, res, next) {
  const token = req.cookies?.[CUSTOMER_ACCESS_COOKIE];
  if (!token) {
    throw new UnauthorizedError("Not authenticated");
  }

  let payload;
  try {
    payload = verifyCustomerAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired session");
  }

  const customer = await getSignedInCustomer(payload.sub);
  if (!customer) {
    throw new UnauthorizedError("Account not found");
  }

  req.customer = customer;
  next();
});

module.exports = { requireCustomer };
