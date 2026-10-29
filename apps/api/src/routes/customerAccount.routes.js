const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  customerProfileUpdateSchema,
  customerChangePasswordSchema,
  customerAddressSchema,
  customerAddressUpdateSchema,
} = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireCustomer } = require("../middleware/customerAuth");
const customerAccountService = require("../services/customerAccount.service");

// Everything under /api/customer-account is the signed-in customer's own data.
// The customer id always comes from the verified session cookie (req.customer),
// never from the URL or body.
const router = express.Router();
router.use(requireCustomer);

// Changing a password asks for the current one, so this is also a guessing
// surface for someone holding a stolen session — keep it tight. Keyed by the
// signed-in customer rather than IP: this router is already behind
// requireCustomer, and the API has no `trust proxy` setting, so behind a
// reverse proxy every visitor would otherwise share one IP and one budget.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `customer:${req.customer.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many password change attempts. Try again later." } },
});

router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    res.json({ profile: await customerAccountService.getProfile(req.customer.id) });
  })
);

router.patch(
  "/profile",
  validateBody(customerProfileUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json({ profile: await customerAccountService.updateProfile(req.customer.id, req.body) });
  })
);

router.post(
  "/change-password",
  changePasswordLimiter,
  validateBody(customerChangePasswordSchema),
  asyncHandler(async (req, res) => {
    await customerAccountService.changePassword(req.customer.id, req.body);
    res.json({ success: true });
  })
);

router.get(
  "/addresses",
  asyncHandler(async (req, res) => {
    res.json({ addresses: await customerAccountService.listAddresses(req.customer.id) });
  })
);

router.post(
  "/addresses",
  validateBody(customerAddressSchema),
  asyncHandler(async (req, res) => {
    const address = await customerAccountService.createAddress(req.customer.id, req.body);
    res.status(201).json({ address });
  })
);

router.patch(
  "/addresses/:id",
  validateBody(customerAddressUpdateSchema),
  asyncHandler(async (req, res) => {
    const address = await customerAccountService.updateAddress(req.customer.id, req.params.id, req.body);
    res.json({ address });
  })
);

router.post(
  "/addresses/:id/default",
  asyncHandler(async (req, res) => {
    const addresses = await customerAccountService.setDefaultAddress(req.customer.id, req.params.id);
    res.json({ addresses });
  })
);

router.delete(
  "/addresses/:id",
  asyncHandler(async (req, res) => {
    const addresses = await customerAccountService.deleteAddress(req.customer.id, req.params.id);
    res.json({ addresses });
  })
);

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query;
    res.json(await customerAccountService.listOrders(req.customer.id, { page, pageSize }));
  })
);

module.exports = router;
