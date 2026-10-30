const express = require("express");
const { prisma } = require("@big-eds/database");
const {
  registerOpenSchema,
  registerCloseSchema,
  registerReopenApproveSchema,
  registerReopenDenySchema,
  posSaleSchema,
  posRefundSchema,
} = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError } = require("../lib/errors");
const posService = require("../services/pos.service");

const router = express.Router();

router.use(requireAuth);

function serializeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
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

// Rings up a walk-in cash or deposit sale and returns the receipt. CARD is
// intentionally rejected here (501) — see docs/requirements/open-questions.md;
// no payment processor/terminal model has been selected yet, and this route
// must never fabricate a successful card charge.
router.post(
  "/sales",
  requirePermission("pos:sell"),
  validateBody(posSaleSchema),
  asyncHandler(async (req, res) => {
    const {
      registerSessionId,
      lines,
      tenderMethod,
      tenderedCents,
      depositAmountCents,
      discountCents,
      discountReasonCode,
      customer,
    } = req.body;

    if (tenderMethod === "CARD") {
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
      tenderMethod,
      tenderedCents,
      depositAmountCents,
      discountCents,
      discountReasonCode,
      customerInput: customer,
      performedById: req.user.id,
    });

    res.status(201).json({
      order: serializeOrder(result.order),
      payment: result.payment,
      receipt: result.receipt,
      changeDueCents: result.changeDueCents,
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

module.exports = router;
