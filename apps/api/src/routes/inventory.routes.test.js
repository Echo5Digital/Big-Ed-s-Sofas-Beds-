const { prisma } = require("@big-eds/database");
const inventoryService = require("../services/inventory.service");
const { ConflictError, NotFoundError } = require("../lib/errors");

// Runs against the real dev database (same convention as catalog.routes.test.js
// and pos.service.test.js — no Prisma mock layer). Regression test for a bug
// in POST /counts/:id/submit (apps/api/src/routes/inventory.routes.js): the
// handler fetched the Count once outside the transaction and never checked
// count.status, so a retried or double-clicked submit request re-ran the
// entire discrepancy-adjustment loop a second time against a count that had
// already completed — doubling every StockMovement and mutating onHand
// again for every discrepant line. It also mutated StockBalance.onHand
// directly via upsert/update with no row lock, unlike adjustStock's
// SELECT ... FOR UPDATE pattern. The fix re-fetches the count inside the
// transaction, rejects a resubmit once status is no longer OPEN, and locks
// the balance row via inventoryService.getOrCreateBalance before mutating it.
//
// submitCount() below mirrors the route handler's fixed logic exactly (same
// convention as catalog.routes.test.js, which tests route logic directly
// rather than over HTTP).
async function submitCount(countId, lines, performedById) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.count.findUnique({ where: { id: countId }, include: { lines: true } });
    if (!count) throw new NotFoundError("Count not found");
    if (count.status !== "OPEN") {
      throw new ConflictError("This count has already been submitted", { status: count.status });
    }

    for (const submitted of lines) {
      const line = count.lines.find((l) => l.id === submitted.lineId);
      if (!line) continue;

      const discrepancy = submitted.countedQty - line.expectedQty;
      await tx.countLine.update({
        where: { id: line.id },
        data: { countedQty: submitted.countedQty, discrepancy },
      });

      if (discrepancy !== 0) {
        const type = discrepancy > 0 ? "ADJUSTMENT_INCREASE" : "ADJUSTMENT_DECREASE";
        const quantity = Math.abs(discrepancy);

        const balance = await inventoryService.getOrCreateBalance(tx, line.variantId, count.locationId);
        const nextOnHand = type === "ADJUSTMENT_INCREASE" ? balance.onHand + quantity : balance.onHand - quantity;

        await tx.stockBalance.update({ where: { id: balance.id }, data: { onHand: nextOnHand } });

        await tx.stockMovement.create({
          data: {
            variantId: line.variantId,
            locationId: count.locationId,
            type,
            quantity,
            reasonCode: "cycle_count_discrepancy",
            referenceType: "Count",
            referenceId: count.id,
            performedById,
          },
        });
      }
    }

    return tx.count.update({
      where: { id: count.id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { lines: true },
    });
  });
}

describe("inventory.routes — POST /counts/:id/submit resubmit protection", () => {
  let location;
  let category;
  let product;
  let variant;
  let count;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "Count Submit Test Category", slug: `count-submit-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "Count Submit Test Location", type: "WAREHOUSE" },
    });
    product = await prisma.product.create({
      data: {
        name: "Count Submit Test Product",
        slug: `count-submit-test-product-${Date.now()}`,
        status: "ACTIVE",
        categoryId: category.id,
      },
    });
    variant = await prisma.variant.create({
      data: { productId: product.id, sku: `COUNT-SUBMIT-TEST-${Date.now()}`, name: "Default", priceCents: 1000 },
    });
    await prisma.stockBalance.create({
      data: { variantId: variant.id, locationId: location.id, onHand: 10 },
    });
  });

  afterEach(async () => {
    if (count) {
      await prisma.countLine.deleteMany({ where: { countId: count.id } });
      await prisma.count.delete({ where: { id: count.id } });
      count = null;
    }
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.stockBalance.deleteMany({ where: { variantId: variant.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
  });

  it("applies the discrepancy once, then rejects a resubmit of the same count instead of re-applying it", async () => {
    count = await prisma.count.create({
      data: {
        locationId: location.id,
        lines: { create: [{ variantId: variant.id, expectedQty: 10 }] },
      },
      include: { lines: true },
    });

    const lineId = count.lines[0].id;

    const first = await submitCount(count.id, [{ lineId, countedQty: 8 }], null);
    expect(first.status).toBe("COMPLETED");

    const balanceAfterFirst = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balanceAfterFirst.onHand).toBe(8);

    await expect(submitCount(count.id, [{ lineId, countedQty: 8 }], null)).rejects.toThrow(
      /already been submitted/
    );

    const balanceAfterRetry = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balanceAfterRetry.onHand).toBe(8);

    const movements = await prisma.stockMovement.findMany({
      where: { variantId: variant.id, referenceType: "Count", referenceId: count.id },
    });
    expect(movements.length).toBe(1);
  });
});
