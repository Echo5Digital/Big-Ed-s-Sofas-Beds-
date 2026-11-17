const express = require("express");
const rateLimit = require("express-rate-limit");
const { prisma } = require("@big-eds/database");
const {
  registerOpenSchema,
  registerCloseSchema,
  registerReopenApproveSchema,
  registerReopenDenySchema,
  posSaleSchema,
  posRefundSchema,
  posCustomerCreateSchema,
  posReturnCreateSchema,
} = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError } = require("../lib/errors");
const posService = require("../services/pos.service");
const posCustomersService = require("../services/posCustomers.service");
const posReturnsService = require("../services/posReturns.service");
const storeCreditService = require("../services/storeCredit.service");

const router = express.Router();

router.use(requireAuth);

// A manager-PIN override is a credential-guessing surface (a 4-6 digit PIN
// against a small known set of managers, see lib/posPin.js) — cap attempts
// per cashier regardless of whether the rest of the request is otherwise
// valid. Modeled on auth.routes.js's loginLimiter.
const saleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  message: { error: { message: "Too many sale attempts. Try again later." } },
});

function serializeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillmentMethod: order.fulfillmentMethod,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    discountPercent: order.discountPercent,
    totalCents: order.totalCents,
    requestedDeliveryAt: order.requestedDeliveryAt,
    shippingAddress: order.shippingAddress ?? null,
    billingAddress: order.billingAddress ?? null,
    salesAttributions: order.salesAttributions?.map((a) => ({
      userId: a.userId,
      role: a.role,
      splitPercent: a.splitPercent,
    })),
    customer: order.customer
      ? { id: order.customer.id, email: order.customer.email, firstName: order.customer.firstName, lastName: order.customer.lastName }
      : null,
    lines: order.lines?.map((l) => ({
      id: l.id,
      sku: l.skuSnapshot,
      name: l.nameSnapshot,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      lineTotalCents: l.lineTotalCents,
    })),
    createdAt: order.createdAt,
  };
}

function serializePayment(payment) {
  return {
    id: payment.id,
    method: payment.method,
    amountCents: payment.amountCents,
    reference: payment.reference,
    status: payment.status,
    createdAt: payment.createdAt,
  };
}

// POS's product search (ProductSearch.jsx) hits the public GET /catalog/
// products?fields=minimal — unauthenticated by design, shared with the
// storefront, so it can never safely carry costCents. This is the
// authenticated alternative the POS cart uses instead: given the variant ids
// already in the cashier's cart, return just their costCents, gated by
// "catalog:cost:view" like every other cost-visibility surface. Returns {}
// (no costs) rather than 403 for a cashier without the permission — the
// cart still works identically, it just shows no cost-floor warning (the
// server-side hard-block in pos.service.js's ringSale is the real guardrail
// regardless of what this endpoint returns).
router.get(
  "/cart-costs",
  requirePermission("pos:sell"),
  asyncHandler(async (req, res) => {
    if (!req.user.permissions.has("catalog:cost:view")) {
      return res.json({ costsByVariantId: {} });
    }
    const ids = String(req.query.variantIds ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return res.json({ costsByVariantId: {} });
    }
    const variants = await prisma.variant.findMany({
      where: { id: { in: ids } },
      select: { id: true, costCents: true },
    });
    const costsByVariantId = Object.fromEntries(variants.map((v) => [v.id, v.costCents]));
    res.json({ costsByVariantId });
  })
);

router.get(
  "/registers",
  requirePermission("pos:register:open"),
  asyncHandler(async (req, res) => {
    const registers = await prisma.register.findMany({
      where: { isActive: true },
      include: {
        location: true,
        sessions: { where: { status: { in: ["OPEN", "PENDING_REOPEN_APPROVAL"] } }, take: 1 },
      },
      orderBy: { name: "asc" },
    });
    res.json({
      registers: registers.map((r) => ({
        id: r.id,
        name: r.name,
        locationId: r.locationId,
        locationName: r.location?.name ?? null,
        openSessionId: r.sessions[0]?.status === "OPEN" ? r.sessions[0].id : null,
        pendingReopenSessionId: r.sessions[0]?.status === "PENDING_REOPEN_APPROVAL" ? r.sessions[0].id : null,
      })),
    });
  })
);

router.post(
  "/registers/open",
  requirePermission("pos:register:open"),
  validateBody(registerOpenSchema),
  asyncHandler(async (req, res) => {
    const session = await posService.openRegister({ ...req.body, openedById: req.user.id });
    res.status(201).json({ session });
  })
);

router.get(
  "/sessions/:id",
  requirePermission("pos:register:open"),
  asyncHandler(async (req, res) => {
    const session = await prisma.registerSession.findUnique({
      where: { id: req.params.id },
      include: { register: true, cashMovements: true, receipts: true },
    });
    if (!session) throw new NotFoundError("Register session not found");
    res.json({ session: { ...posService.serializeSession(session), cashMovements: session.cashMovements } });
  })
);

router.post(
  "/sessions/:id/close",
  requirePermission("pos:register:close"),
  validateBody(registerCloseSchema),
  asyncHandler(async (req, res) => {
    const session = await posService.closeRegister({
      registerSessionId: req.params.id,
      ...req.body,
      performedById: req.user.id,
    });
    res.json({ session });
  })
);

// Cashier-facing: found a register stuck OPEN from a previous shift and
// cannot close it out themselves — submits it for manager/admin review
// instead. Same permission as a normal close, since this replaces that
// action for a session the cashier doesn't own.
router.post(
  "/sessions/:id/request-reopen",
  requirePermission("pos:register:close"),
  asyncHandler(async (req, res) => {
    const session = await posService.requestReopen({
      registerSessionId: req.params.id,
      requestedById: req.user.id,
    });
    res.json({ session });
  })
);

// Admin/manager-facing: lists every register awaiting reopen approval —
// backs the admin notification bell and the approvals page.
router.get(
  "/registers/pending-reopens",
  requirePermission("pos:register:approve-reopen"),
  asyncHandler(async (req, res) => {
    const sessions = await posService.listPendingReopens();
    res.json({ sessions });
  })
);

router.post(
  "/sessions/:id/approve-reopen",
  requirePermission("pos:register:approve-reopen"),
  validateBody(registerReopenApproveSchema),
  asyncHandler(async (req, res) => {
    const session = await posService.approveReopen({
      registerSessionId: req.params.id,
      ...req.body,
      performedById: req.user.id,
    });
    res.json({ session });
  })
);

router.post(
  "/sessions/:id/deny-reopen",
  requirePermission("pos:register:approve-reopen"),
  validateBody(registerReopenDenySchema),
  asyncHandler(async (req, res) => {
    const session = await posService.denyReopen({
      registerSessionId: req.params.id,
      ...req.body,
      performedById: req.user.id,
    });
    res.json({ session });
  })
);

// Rings up a walk-in sale across one or more payment entries (CASH, DEPOSIT,
// BANK_TRANSFER, STORE_CREDIT) and returns the receipt. CARD is intentionally
// rejected here (501) — see docs/requirements/open-questions.md; no payment
// processor/terminal model has been selected yet, and this route must never
// fabricate a successful card charge.
router.post(
  "/sales",
  requirePermission("pos:sell"),
  saleLimiter,
  validateBody(posSaleSchema),
  asyncHandler(async (req, res) => {
    const {
      registerSessionId,
      lines,
      payments,
      discount,
      discountReasonCode,
      pinOverride,
      salesAttribution,
      requestedDeliveryAt,
      shippingAddress,
      billingAddress,
      billingSameAsShipping,
      customerId,
      customer,
    } = req.body;

    if (payments.some((p) => p.method === "CARD")) {
      return res.status(501).json({
        error: {
          message:
            "Card-present tender is not available yet — no payment processor or terminal model has been selected.",
        },
      });
    }

    const result = await posService.ringSale({
      registerSessionId,
      lines,
      payments,
      discount,
      discountReasonCode,
      pinOverride,
      salesAttribution,
      requestedDeliveryAt,
      shippingAddress,
      billingAddress,
      billingSameAsShipping,
      customerId,
      customerInput: customer,
      performedById: req.user.id,
    });

    res.status(201).json({
      order: serializeOrder(result.order),
      payments: result.payments.map(serializePayment),
      receipt: result.receipt,
      changeDueCents: result.changeDueCents,
    });
  })
);

// Lightweight staff roster for the POS sales-attribution picker. POS users
// only hold pos:* permissions, not users:manage, so the admin's GET /users
// (gated on users:manage) would 403 a cashier — this exposes just what the
// picker needs, including employeeId (so a cashier can look a staff member
// up by badge number), but never email or PIN data.
router.get(
  "/staff",
  requirePermission("pos:sell"),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: { roles: { include: { role: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    res.json({
      staff: users.map((u) => ({
        id: u.id,
        employeeId: u.employeeId,
        firstName: u.firstName,
        lastName: u.lastName,
        roles: u.roles.map((ur) => ur.role.name),
      })),
    });
  })
);

router.post(
  "/refunds",
  requirePermission("pos:refund"),
  validateBody(posRefundSchema),
  asyncHandler(async (req, res) => {
    const refundRecord = await posService.refund({ ...req.body, performedById: req.user.id });
    res.status(201).json({ refund: refundRecord });
  })
);

// --- Customer search / creation (checkout customer identification) --------

router.get(
  "/customers/search",
  requirePermission("pos:sell"),
  asyncHandler(async (req, res) => {
    const customers = await posCustomersService.searchCustomersForPos({ q: req.query.q });
    res.json({ customers });
  })
);

router.post(
  "/customers",
  requirePermission("pos:sell"),
  validateBody(posCustomerCreateSchema),
  asyncHandler(async (req, res) => {
    const customer = await posCustomersService.createPosCustomer(req.body);
    res.status(201).json({ customer });
  })
);

router.get(
  "/customers/:id/store-credit",
  requirePermission("pos:sell"),
  asyncHandler(async (req, res) => {
    const balanceCents = await storeCreditService.getStoreCreditBalance(req.params.id);
    res.json({ balanceCents });
  })
);

// --- Returns / exchanges ---------------------------------------------------

router.get(
  "/returns/find-order",
  requirePermission("pos:refund"),
  asyncHandler(async (req, res) => {
    const result = await posReturnsService.findOrderForReturn({ q: req.query.q });
    res.json(result);
  })
);

router.post(
  "/returns",
  requirePermission("pos:refund"),
  validateBody(posReturnCreateSchema),
  asyncHandler(async (req, res) => {
    const result = await posReturnsService.createReturn({ ...req.body, performedById: req.user.id });
    res.status(201).json({
      returnTransaction: result.returnTransaction,
      exchangeOrder: result.exchangeOrder,
      refund: result.refundRecord,
      storeCredit: result.storeCreditRecord,
      exchangePayments: result.exchangePayments.map(serializePayment),
      balanceDueCents: result.balanceDueCents,
    });
  })
);

module.exports = router;
