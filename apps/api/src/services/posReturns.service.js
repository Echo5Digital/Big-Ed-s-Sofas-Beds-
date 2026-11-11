const { prisma } = require("@big-eds/database");
const { ConflictError, NotFoundError } = require("../lib/errors");
const { createWithSequentialNumber } = require("../lib/sequentialNumber");
const inventoryService = require("./inventory.service");
const posService = require("./pos.service");
const storeCreditService = require("./storeCredit.service");

async function nextReturnReceiptNumber(tx) {
  const count = await tx.returnTransaction.count();
  return `RTN-${100000 + count + 1}`;
}

async function nextOrderNumber(tx) {
  const count = await tx.order.count();
  return `BE-${100000 + count + 1}`;
}

// Historical snapshot rule (same as OrderLine.unitPriceCents/skuSnapshot):
// a return's eligible refund is derived from the ORIGINAL sale's price and
// discount, never recomputed from the current catalog.
function perUnitRefundCents(orderLine) {
  const discountPerUnit = orderLine.quantity > 0 ? Math.floor(orderLine.discountCents / orderLine.quantity) : 0;
  return orderLine.unitPriceCents - discountPerUnit;
}

const ORDER_DETAIL_INCLUDE = {
  lines: {
    include: {
      variant: {
        include: {
          product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
        },
      },
    },
  },
  payments: true,
  customer: true,
  receipts: true,
  refunds: true,
};

function serializeOrderForReturn(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    paymentStatus: order.paymentStatus,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    customer: order.customer
      ? {
          id: order.customer.id,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          email: order.customer.email,
          phone: order.customer.phone,
        }
      : null,
    receipts: order.receipts.map((r) => ({ id: r.id, receiptNumber: r.receiptNumber, createdAt: r.createdAt })),
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountCents: p.amountCents,
      status: p.status,
      createdAt: p.createdAt,
    })),
    refunds: order.refunds.map((r) => ({ id: r.id, amountCents: r.amountCents, reasonCode: r.reasonCode, createdAt: r.createdAt })),
  };
}

// Looks up one order by order number, receipt number, or customer phone
// (contains match — returns the single most recent matching order). Builds
// the "full order detail" shape that doesn't exist anywhere else in the repo
// (closest precedent, GET /orders/:id, only includes lines+customer).
async function findOrderForReturn({ q }) {
  const query = String(q ?? "").trim();
  if (!query) throw new ConflictError("Search query is required");

  let order = await prisma.order.findFirst({
    where: {
      channel: "POS",
      OR: [
        { orderNumber: { contains: query, mode: "insensitive" } },
        { receipts: { some: { receiptNumber: { contains: query, mode: "insensitive" } } } },
        { customer: { phone: { contains: query, mode: "insensitive" } } },
      ],
    },
    include: ORDER_DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  if (!order) throw new NotFoundError("No matching order found");

  const orderLineIds = order.lines.map((l) => l.id);
  const returnedByLine = await prisma.returnLine.groupBy({
    by: ["orderLineId"],
    where: { orderLineId: { in: orderLineIds } },
    _sum: { quantity: true },
  });
  const previouslyReturnedByLineId = new Map(returnedByLine.map((r) => [r.orderLineId, r._sum.quantity || 0]));

  return {
    order: serializeOrderForReturn(order),
    lines: order.lines.map((line) => {
      const previouslyReturnedQty = previouslyReturnedByLineId.get(line.id) || 0;
      return {
        id: line.id,
        variantId: line.variantId,
        sku: line.skuSnapshot,
        name: line.nameSnapshot,
        imageUrl: line.variant?.product?.images?.[0]?.url ?? null,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        discountCents: line.discountCents,
        lineTotalCents: line.lineTotalCents,
        previouslyReturnedQty,
        eligibleQty: line.quantity - previouslyReturnedQty,
        unitRefundCents: perUnitRefundCents(line),
      };
    }),
  };
}

// Core operation: validates return quantities, writes the
// ReturnTransaction/ReturnLine header rows, applies the correct inventory
// movement per line's condition, and settles money — either a straight
// refund/store credit (no exchange) or a replacement-item exchange with a
// balance due or owed.
//
// Deliberately NOT one giant prisma.$transaction wrapping every step: the
// header-row creation below is its own short transaction (mirroring
// ringSale()'s order-create step), and each inventory/payment/refund call
// after it (restockFromReturn, quarantineStock, reserveAndConvertForSale,
// createPaymentEntries, refund(), issueStoreCredit) commits independently —
// exactly the same multi-step shape ringSale() already uses for stock
// reserve+convert vs. payment recording. Wrapping all of it in one
// interactive transaction was tried first and reliably blew Prisma's
// default 5s interactive-transaction timeout once more than one or two
// network round trips were nested inside it, since each of those "helper"
// functions already opens its own transaction — nesting prisma.$transaction
// calls doesn't compose into one longer-lived transaction, it just queues
// redundant round trips inside the outer one's deadline. Safety instead
// comes from: the return-quantity/order lock check happening in the first
// short transaction (so two concurrent returns against the same order still
// serialize), and a real compensating rollback if the exchange's
// replacement stock reservation fails partway (mirroring ringSale()'s own
// rollback-on-partial-failure pattern) — never a half-applied return left
// ambiguous.
async function createReturn({
  orderId,
  registerSessionId,
  lines,
  refundMethod,
  paymentId,
  exchangeReplacements,
  balancePayments,
  performedById,
}) {
  const session = await prisma.registerSession.findUnique({
    where: { id: registerSessionId },
    include: { register: true },
  });
  if (!session) throw new NotFoundError("Register session not found");
  if (session.status !== "OPEN") throw new ConflictError("Register session is not open");
  const locationId = session.register.locationId;
  if (!locationId) throw new ConflictError("Register is not assigned to a stock location");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true, customer: true },
  });
  if (!order) throw new NotFoundError("Order not found");

  const orderLineById = new Map(order.lines.map((l) => [l.id, l]));
  for (const line of lines) {
    if (!orderLineById.has(line.orderLineId)) {
      throw new ConflictError(`Order line ${line.orderLineId} does not belong to this order`);
    }
  }

  const hasExchange = Boolean(exchangeReplacements?.length);
  let replacementVariants = [];
  let replacementById = new Map();
  if (hasExchange) {
    const replacementIds = exchangeReplacements.map((r) => r.variantId);
    replacementVariants = await prisma.variant.findMany({
      where: { id: { in: replacementIds } },
      include: { product: true },
    });
    replacementById = new Map(replacementVariants.map((v) => [v.id, v]));
    for (const r of exchangeReplacements) {
      const variant = replacementById.get(r.variantId);
      if (!variant || !variant.isActive) {
        throw new ConflictError(`Replacement variant ${r.variantId} is not available`);
      }
    }
  }

  const customerId = order.customerId || null;

  // Step 1 (short transaction): lock the order row, re-check return
  // quantities against the authoritative, freshly-read returned-so-far
  // total (so two concurrent returns against the same order still
  // serialize), then write the ReturnTransaction/ReturnLine header rows and
  // (for an exchange) the replacement Order shell.
  const { returnTransaction, exchangeOrder, lineInputs, totalRefundCents, replacementTotalCents } =
    await createWithSequentialNumber(() =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

        const orderLineIds = lines.map((l) => l.orderLineId);
        const returnedByLine = await tx.returnLine.groupBy({
          by: ["orderLineId"],
          where: { orderLineId: { in: orderLineIds } },
          _sum: { quantity: true },
        });
        const previouslyReturnedByLineId = new Map(returnedByLine.map((r) => [r.orderLineId, r._sum.quantity || 0]));

        let runningTotalRefundCents = 0;
        const lineInputs = [];
        for (const line of lines) {
          const orderLine = orderLineById.get(line.orderLineId);
          const previouslyReturnedQty = previouslyReturnedByLineId.get(line.orderLineId) || 0;
          const eligibleQty = orderLine.quantity - previouslyReturnedQty;
          if (line.quantity > eligibleQty) {
            throw new ConflictError(`Return quantity for ${orderLine.skuSnapshot} exceeds the eligible quantity`, {
              orderLineId: line.orderLineId,
              eligibleQty,
              requestedQty: line.quantity,
            });
          }
          const unitRefundCents = perUnitRefundCents(orderLine);
          runningTotalRefundCents += unitRefundCents * line.quantity;
          lineInputs.push({ ...line, orderLine, unitRefundCents });
        }

        let exchangeOrder = null;
        let replacementTotalCents = 0;
        if (hasExchange) {
          replacementTotalCents = exchangeReplacements.reduce(
            (sum, r) => sum + replacementById.get(r.variantId).priceCents * r.quantity,
            0
          );

          const exchangeOrderNumber = await nextOrderNumber(tx);
          exchangeOrder = await tx.order.create({
            data: {
              orderNumber: exchangeOrderNumber,
              channel: "POS",
              customerId,
              status: "DRAFT",
              paymentStatus: "UNPAID",
              fulfillmentStatus: "UNALLOCATED",
              fulfillmentMethod: "IN_STORE",
              subtotalCents: replacementTotalCents,
              totalCents: replacementTotalCents,
              lines: {
                create: exchangeReplacements.map((r) => {
                  const variant = replacementById.get(r.variantId);
                  return {
                    variantId: variant.id,
                    skuSnapshot: variant.sku,
                    nameSnapshot: `${variant.product.name} — ${variant.name}`,
                    quantity: r.quantity,
                    unitPriceCents: variant.priceCents,
                    lineTotalCents: variant.priceCents * r.quantity,
                  };
                }),
              },
            },
          });
        }

        const receiptNumber = await nextReturnReceiptNumber(tx);
        const returnTransaction = await tx.returnTransaction.create({
          data: {
            orderId,
            receiptNumber,
            registerSessionId,
            customerId,
            exchangeOrderId: exchangeOrder?.id || null,
            totalRefundCents: runningTotalRefundCents,
            performedById,
            lines: {
              create: lineInputs.map((l) => ({
                orderLineId: l.orderLineId,
                variantId: l.orderLine.variantId,
                quantity: l.quantity,
                unitRefundCents: l.unitRefundCents,
                condition: l.condition,
                reasonCode: l.reasonCode,
                replacementVariantId: l.replacementVariantId || null,
              })),
            },
          },
        });

        return {
          returnTransaction,
          exchangeOrder,
          lineInputs,
          totalRefundCents: runningTotalRefundCents,
          replacementTotalCents,
        };
      })
    );

  // Step 2 (independent calls, each its own transaction): apply the correct
  // inventory movement per line's condition — sellable returns add back to
  // on-hand, anything else goes to quarantine, never the other way around.
  for (const l of lineInputs) {
    const fn = l.condition === "SELLABLE" ? inventoryService.restockFromReturn : inventoryService.quarantineStock;
    await fn({
      variantId: l.orderLine.variantId,
      locationId,
      quantity: l.quantity,
      reasonCode: `return:${l.reasonCode}`,
      referenceId: returnTransaction.id,
      performedById,
    });
  }

  let balanceDueCents = 0;
  let refundRecord = null;
  let storeCreditRecord = null;
  let exchangePayments = [];

  if (hasExchange) {
    // Reserve+convert replacement stock — same per-line transactional
    // primitive ringSale() uses, so pricing/locking guarantees match.
    const settled = await Promise.allSettled(
      exchangeReplacements.map((r) =>
        inventoryService.reserveAndConvertForSale({
          variantId: r.variantId,
          locationId,
          quantity: r.quantity,
          orderId: exchangeOrder.id,
          performedById,
          referenceId: exchangeOrder.id,
        })
      )
    );
    const failed = [];
    const succeededVariantIds = [];
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") succeededVariantIds.push(exchangeReplacements[i].variantId);
      else failed.push(exchangeReplacements[i].variantId);
    });
    if (failed.length > 0) {
      // Compensate every replacement line that did succeed — same
      // rollback-on-partial-failure pattern ringSale() uses.
      for (const variantId of succeededVariantIds) {
        const r = exchangeReplacements.find((x) => x.variantId === variantId);
        await inventoryService.adjustStock({
          variantId,
          locationId,
          type: "ADJUSTMENT_INCREASE",
          quantity: r.quantity,
          reasonCode: "pos_exchange_rollback",
          performedById,
        });
      }
      await prisma.order.update({ where: { id: exchangeOrder.id }, data: { status: "CANCELED" } });
      throw new ConflictError("One or more replacement items went out of stock during this exchange", {
        unavailableVariantIds: failed,
      });
    }

    const diffCents = replacementTotalCents - totalRefundCents;
    if (diffCents > 0) {
      balanceDueCents = diffCents;
      const collectedCents = balancePayments?.reduce((s, p) => s + p.amountCents, 0) ?? 0;
      if (collectedCents < diffCents) {
        throw new ConflictError("Balance due was not fully collected for this exchange", {
          balanceDueCents: diffCents,
          collectedCents,
        });
      }
      exchangePayments = await prisma.$transaction((tx) =>
        posService.createPaymentEntries(tx, {
          orderId: exchangeOrder.id,
          registerSessionId,
          payments: balancePayments,
          customerId,
          performedById,
        })
      );
      await prisma.order.update({
        where: { id: exchangeOrder.id },
        data: { status: "CONFIRMED", fulfillmentStatus: "READY", paymentStatus: "PAID" },
      });
    } else if (diffCents < 0) {
      const owedCents = -diffCents;
      if (refundMethod === "STORE_CREDIT") {
        storeCreditRecord = await prisma.$transaction((tx) =>
          storeCreditService.issueStoreCredit(tx, {
            customerId,
            amountCents: owedCents,
            returnTransactionId: returnTransaction.id,
            performedById,
          })
        );
      } else {
        refundRecord = await posService.refund({
          registerSessionId,
          orderId,
          amountCents: owedCents,
          reasonCode: "pos_exchange_refund",
          notes: `Exchange balance for return ${returnTransaction.receiptNumber}`,
          paymentId,
          performedById,
        });
      }
      await prisma.order.update({
        where: { id: exchangeOrder.id },
        data: { status: "CONFIRMED", fulfillmentStatus: "READY", paymentStatus: "PAID" },
      });
    } else {
      await prisma.order.update({
        where: { id: exchangeOrder.id },
        data: { status: "CONFIRMED", fulfillmentStatus: "READY", paymentStatus: "PAID" },
      });
    }
  } else if (totalRefundCents > 0) {
    if (refundMethod === "STORE_CREDIT") {
      storeCreditRecord = await prisma.$transaction(async (tx) => {
        const credit = await storeCreditService.issueStoreCredit(tx, {
          customerId,
          amountCents: totalRefundCents,
          returnTransactionId: returnTransaction.id,
          performedById,
        });

        // Store-credit refunds still move Order.paymentStatus the same way
        // a Refund would — no money left the register, but the amount is
        // still "returned" against the order. A single order can
        // accumulate returns across both ledgers over time (one return
        // refunded in cash, a later one issued as store credit), so both
        // must be summed to know the true returned-so-far total.
        const [alreadyRefunded, alreadyStoreCredited] = await Promise.all([
          tx.refund.aggregate({ where: { orderId }, _sum: { amountCents: true } }),
          tx.storeCredit.aggregate({
            where: { orderId: null, returnTransaction: { orderId }, reason: "ISSUED_FROM_RETURN" },
            _sum: { amountCents: true },
          }),
        ]);
        const totalReturned =
          (alreadyRefunded._sum.amountCents || 0) + (alreadyStoreCredited._sum.amountCents || 0) + totalRefundCents;
        const paymentStatus = totalReturned >= order.totalCents ? "REFUNDED" : "PARTIALLY_PAID";
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });

        return credit;
      });
    } else {
      refundRecord = await posService.refund({
        registerSessionId,
        orderId,
        amountCents: totalRefundCents,
        reasonCode: lineInputs[0]?.reasonCode || "OTHER",
        notes: `Return ${returnTransaction.receiptNumber}`,
        paymentId,
        performedById,
      });
    }
  }

  return {
    returnTransaction,
    exchangeOrder,
    refundRecord,
    storeCreditRecord,
    exchangePayments,
    balanceDueCents,
  };
}

module.exports = {
  findOrderForReturn,
  createReturn,
};
