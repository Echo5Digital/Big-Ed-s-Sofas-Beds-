const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  customerRegisterSchema,
  customerVerifyOtpSchema,
  customerResendOtpSchema,
  customerLoginSchema,
} = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireCustomer } = require("../middleware/customerAuth");
const { UnauthorizedError } = require("../lib/errors");
const {
  CUSTOMER_REFRESH_COOKIE,
  verifyCustomerRefreshToken,
  setCustomerSessionCookies,
  clearCustomerSessionCookies,
} = require("../lib/customerTokens");
const customerAuthService = require("../services/customerAuth.service");

const router = express.Router();

function limiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message } },
  });
}

const registerLimiter = limiter(10, "Too many sign-up attempts. Try again later.");
const verifyLimiter = limiter(30, "Too many verification attempts. Try again later.");
const resendLimiter = limiter(10, "Too many code requests. Try again later.");
const loginLimiter = limiter(10, "Too many login attempts. Try again later.");

router.post(
  "/register",
  registerLimiter,
  validateBody(customerRegisterSchema),
  asyncHandler(async (req, res) => {
    const result = await customerAuthService.startRegistration(req.body);
    res.status(201).json(result);
  })
);

router.post(
  "/verify-otp",
  verifyLimiter,
  validateBody(customerVerifyOtpSchema),
  asyncHandler(async (req, res) => {
    const customer = await customerAuthService.verifyRegistration(req.body);
    setCustomerSessionCookies(res, customer.id);
    res.json({ customer });
  })
);

router.post(
  "/resend-otp",
  resendLimiter,
  validateBody(customerResendOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await customerAuthService.resendRegistrationCode(req.body);
    res.json(result);
  })
);

router.post(
  "/login",
  loginLimiter,
  validateBody(customerLoginSchema),
  asyncHandler(async (req, res) => {
    const customer = await customerAuthService.loginCustomer(req.body);
    setCustomerSessionCookies(res, customer.id);
    res.json({ customer });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[CUSTOMER_REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedError("No refresh token");
    }

    let payload;
    try {
      payload = verifyCustomerRefreshToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const customer = await customerAuthService.getSignedInCustomer(payload.sub);
    if (!customer) {
      throw new UnauthorizedError("Account not found");
    }

    setCustomerSessionCookies(res, customer.id);
    res.json({ customer });
  })
);

router.post("/logout", (req, res) => {
  clearCustomerSessionCookies(res);
  res.json({ success: true });
});

router.get("/me", requireCustomer, (req, res) => {
  res.json({ customer: req.customer });
});

module.exports = router;
