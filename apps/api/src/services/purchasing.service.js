const { prisma } = require("@big-eds/database");
const { ConflictError, NotFoundError } = require("../lib/errors");

// Extracted from POST /purchase-orders/:id/receive (purchasing.routes.js) so
// this transaction can be covered by a direct unit test (see
// purchasing.service.test.js) the same way pos.service.js's business logic
// is tested, rather than only reachable through a full HTTP request.
async function receivePurchaseOrder({ purchaseOrderId, locationId, notes, lines, receivedById }) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lines: true },
  });
  if (!po) throw new NotFoundError("Purchase order not found");
  if (!["SENT_TO_VENDOR", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw new ConflictError(`Cannot receive against a PO in status ${po.status}`);
  }

  // Explicit timeout: this transaction does several sequential round-trips
  // per receipt line (PO line update, stock balance upsert+update, stock
  // movement, variant cost update, price history) against a remote Postgres
  // instance — Prisma's 5s interactive-transaction default was observed to
  // be too tight for a multi-line receipt under real network latency,
  // aborting mid-transaction with "Transaction not found" once the clock ran
  // out. 30s comfortably covers a large receipt; maxWait only affects how
  // long a caller queues for a free connection, not the transaction itself.
  return prisma.$transaction(
    async (tx) => {
      const createdReceipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: po.id,
          locationId,
          receivedById,
          notes,
          lines: {
            create: lines.map((l) => ({
              poLineId: l.poLineId,
              acceptedQty: l.acceptedQty,
              damagedQty: l.damagedQty ?? 0,
              differenceNotes: l.differenceNotes,
            })),
          },
        },
        include: { lines: true },
      });

      for (const receiptLine of lines) {
        const poLine = po.lines.find((l) => l.id === receiptLine.poLineId);
        if (!poLine) continue;

        const newReceivedQty = poLine.receivedQty + receiptLine.acceptedQty;
        if (newReceivedQty > poLine.expectedQty) {
          throw new ConflictError(
            `Receiving ${receiptLine.acceptedQty} units for SKU ${poLine.skuSnapshot} would exceed the expected quantity`,
            { expectedQty: poLine.expectedQty, alreadyReceived: poLine.receivedQty }
          );
        }

        // A line left short (receivedQty < expectedQty) keeps whatever
        // balance note this receipt provided, or its prior note if this
        // round didn't supply one. A line that just became fully received
        // has no outstanding balance left to annotate, so the note clears.
        const stillShort = newReceivedQty < poLine.expectedQty;
        await tx.pOLine.update({
          where: { id: poLine.id },
          data: {
            receivedQty: newReceivedQty,
            pendingNote: stillShort ? (receiptLine.pendingNote ?? poLine.pendingNote) : null,
          },
        });

        if (receiptLine.acceptedQty > 0) {
          const balance = await tx.stockBalance.upsert({
            where: { variantId_locationId: { variantId: poLine.variantId, locationId } },
            update: {},
            create: { variantId: poLine.variantId, locationId },
          });
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { onHand: { increment: receiptLine.acceptedQty } },
          });
          await tx.stockMovement.create({
            data: {
              variantId: poLine.variantId,
              locationId,
              type: "RECEIPT",
              quantity: receiptLine.acceptedQty,
              referenceType: "GoodsReceipt",
              referenceId: createdReceipt.id,
              performedById: receivedById,
            },
          });

          // Variant.costCents ("last known supplier cost") reflects what we
          // actually paid on the most recent real receipt, not the ordered
          // PO price, which can be renegotiated/corrected before the goods
          // arrive — this receive step is the only moment a cost becomes
          // true/confirmed rather than merely expected. PriceHistory records
          // both sides of the margin at that moment (current sale price +
          // the new cost) so later reporting can reconstruct what the margin
          // was on any given date, not just today's snapshot.
          const updatedVariant = await tx.variant.update({
            where: { id: poLine.variantId },
            data: { costCents: poLine.unitCostCents },
          });
          await tx.priceHistory.create({
            data: {
              variantId: poLine.variantId,
              priceCents: updatedVariant.priceCents,
              costCents: poLine.unitCostCents,
              changedBy: receivedById,
            },
          });
        }

        if (receiptLine.damagedQty > 0) {
          const balance = await tx.stockBalance.upsert({
            where: { variantId_locationId: { variantId: poLine.variantId, locationId } },
            update: {},
            create: { variantId: poLine.variantId, locationId },
          });
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { quarantined: { increment: receiptLine.damagedQty } },
          });
        }
      }

      const refreshedLines = await tx.pOLine.findMany({ where: { purchaseOrderId: po.id } });
      const fullyReceived = refreshedLines.every((l) => l.receivedQty >= l.expectedQty);
      const anyReceived = refreshedLines.some((l) => l.receivedQty > 0);

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: fullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status },
      });

      return createdReceipt;
    },
    { timeout: 30000, maxWait: 10000 }
  );
}

module.exports = { receivePurchaseOrder };
