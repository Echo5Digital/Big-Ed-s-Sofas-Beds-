const express = require("express");
const { prisma } = require("@big-eds/database");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { NotFoundError } = require("../lib/errors");

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission("reports:read"));

function parseDayRange(dateParam) {
  const start = dateParam ? new Date(dateParam) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// A Payment has no direct relation to a staff User — recorded-by is only
// knowable for POS sales, via Payment -> Order -> Receipt -> RegisterSession
// -> openedBy. Online/Stripe payments have no register session at all, so
// those resolve to a fixed label instead of a staff name. See
// docs/database/schema.md for why this join exists instead of a FK.
function resolveRecordedBy(order) {
  const session = order.receipts?.find((r) => r.registerSession)?.registerSession;
  if (session?.openedBy) {
    return `${session.openedBy.firstName} ${session.openedBy.lastName}`;
  }
  if (order.channel === "ONLINE") return "Online checkout (customer)";
  return "—";
}

function serializePayment(payment) {
  const order = payment.order;
  return {
    id: payment.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customer
      ? `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || order.customer.email
      : "Guest",
    customerEmail: order.customer?.email ?? null,
    method: payment.method,
    source: order.channel === "ONLINE" ? "ONLINE" : "POS",
    amountCents: payment.amountCents,
    currency: "USD",
    status: payment.status,
    providerName: payment.providerName,
    providerRef: payment.providerRef,
    failureReason: payment.failureReason,
    recordedBy: resolveRecordedBy(order),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

const paymentInclude = {
  order: {
    include: {
      customer: true,
      receipts: { include: { registerSession: { include: { openedBy: true } } } },
    },
  },
};

// --- Dashboard statistics ---------------------------------------------------
//
// All revenue tiles sum Payment.amountCents directly (never Order.totalCents)
// so partially-paid/deposit orders are reflected accurately, and only count
// SUCCEEDED payments — a PENDING or FAILED Payment row is not revenue.
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const { start: todayStart, end: todayEnd } = parseDayRange();
    const monthStart = startOfMonth();

    const [
      collectedTodayAgg,
      collectedMonthAgg,
      outstandingAgg,
      depositsAgg,
      refundsAgg,
      failedCount,
      onlineAgg,
      posCardAgg,
      cashAgg,
      bankTransferAgg,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", createdAt: { gte: todayStart, lt: todayEnd } },
        _sum: { amountCents: true },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", createdAt: { gte: monthStart } },
        _sum: { amountCents: true },
      }),
      // Outstanding = total of orders not yet fully paid, less whatever has
      // already been collected toward them (UNPAID counts the full order
      // total; PARTIALLY_PAID counts only the remainder).
      prisma.order.findMany({
        where: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] }, status: { not: "CANCELED" } },
        include: { payments: { where: { status: "SUCCEEDED" } } },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", method: "DEPOSIT" },
        _sum: { amountCents: true },
      }),
      prisma.refund.aggregate({ _sum: { amountCents: true } }),
      prisma.payment.count({ where: { status: "FAILED" } }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", order: { channel: "ONLINE" } },
        _sum: { amountCents: true },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", method: "CARD", order: { channel: "POS" } },
        _sum: { amountCents: true },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", method: "CASH" },
        _sum: { amountCents: true },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", method: "BANK_TRANSFER" },
        _sum: { amountCents: true },
      }),
    ]);

    const outstandingCents = outstandingAgg.reduce((sum, order) => {
      const paid = order.payments.reduce((s, p) => s + p.amountCents, 0);
      return sum + Math.max(order.totalCents - paid, 0);
    }, 0);

    res.json({
      collectedTodayCents: collectedTodayAgg._sum.amountCents ?? 0,
      collectedMonthCents: collectedMonthAgg._sum.amountCents ?? 0,
      outstandingCents,
      depositsCollectedCents: depositsAgg._sum.amountCents ?? 0,
      refundsCents: refundsAgg._sum.amountCents ?? 0,
      failedTransactions: failedCount,
      onlineRevenueCents: onlineAgg._sum.amountCents ?? 0,
      posCardRevenueCents: posCardAgg._sum.amountCents ?? 0,
      cashRevenueCents: cashAgg._sum.amountCents ?? 0,
      bankTransferRevenueCents: bankTransferAgg._sum.amountCents ?? 0,
    });
  })
);

// --- List -------------------------------------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { method, status, source, from, to, q } = req.query;

    const orderWhere = {
      ...(source === "ONLINE" ? { channel: "ONLINE" } : {}),
      ...(source === "POS" ? { channel: "POS" } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: String(q), mode: "insensitive" } },
              { customer: { email: { contains: String(q), mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const where = {
      ...(method ? { method: String(method) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(Object.keys(orderWhere).length ? { order: orderWhere } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(String(from)) } : {}),
              ...(to ? { lt: new Date(String(to)) } : {}),
            },
          }
        : {}),
    };

    const payments = await prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json({ payments: payments.map(serializePayment) });
  })
);

// --- Detail -------------------------------------------------------------------

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        ...paymentInclude,
        order: {
          include: {
            ...paymentInclude.order.include,
            refunds: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundError("Payment not found");

    res.json({
      payment: {
        ...serializePayment(payment),
        refunds: payment.order.refunds.map((r) => ({
          id: r.id,
          amountCents: r.amountCents,
          reasonCode: r.reasonCode,
          notes: r.notes,
          processedById: r.processedById,
          createdAt: r.createdAt,
        })),
      },
    });
  })
);

module.exports = router;
