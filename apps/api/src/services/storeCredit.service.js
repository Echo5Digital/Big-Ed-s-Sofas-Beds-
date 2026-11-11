const { prisma } = require("@big-eds/database");
const { ConflictError } = require("../lib/errors");

// Balance is always computed as sum(amountCents) for a customer, never
// stored directly — same "never store what can be computed" rule
// availableToSell already follows for stock. Issued rows are positive
// (ISSUED_FROM_RETURN), redeemed rows are negative (REDEEMED).
async function getBalance(tx, customerId) {
  const result = await tx.storeCredit.aggregate({
    where: { customerId },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents || 0;
}

async function getStoreCreditBalance(customerId) {
  return getBalance(prisma, customerId);
}

// Issues store credit to a customer (positive ledger row), typically from a
// return. Must run inside the caller's existing transaction so it commits
// atomically with the return/refund it's part of.
async function issueStoreCredit(tx, { customerId, amountCents, returnTransactionId, performedById }) {
  if (!customerId) {
    throw new ConflictError("Store credit can only be issued to an identified customer");
  }
  if (amountCents <= 0) {
    throw new ConflictError("Store credit amount must be greater than zero");
  }
  return tx.storeCredit.create({
    data: {
      customerId,
      amountCents,
      reason: "ISSUED_FROM_RETURN",
      returnTransactionId,
      performedById,
    },
  });
}

// Redeems store credit as a sale tender (negative ledger row). Locks the
// Customer row itself (which always exists, unlike the ledger — a brand-new
// customer with their first-ever credit issuance would have no StoreCredit
// rows to lock yet) before re-reading the balance, so two concurrent
// redemptions can't both read the same balance and jointly overspend it —
// same row-lock-before-re-read pattern as pos.service.js:refund()'s order
// lock.
async function redeemStoreCredit(tx, { customerId, amountCents, orderId, performedById }) {
  if (!customerId) {
    throw new ConflictError("Store credit can only be redeemed by an identified customer");
  }
  if (amountCents <= 0) {
    throw new ConflictError("Redemption amount must be greater than zero");
  }

  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;

  const balance = await getBalance(tx, customerId);
  if (amountCents > balance) {
    throw new ConflictError("Redemption amount exceeds the customer's store credit balance", {
      balanceCents: balance,
      requestedCents: amountCents,
    });
  }

  return tx.storeCredit.create({
    data: {
      customerId,
      amountCents: -amountCents,
      reason: "REDEEMED",
      orderId,
      performedById,
    },
  });
}

module.exports = {
  getStoreCreditBalance,
  issueStoreCredit,
  redeemStoreCredit,
};
