// One-time backfill, two independent passes:
//
// 1. Sale Price (priceCents): some already-seeded variants were created with
//    no real price (priceCents = 0). Assigns a random, category-appropriate
//    US retail price to any such variant so it isn't sold for $0.
// 2. Original Price (compareAtCents): gives every variant without one a
//    randomly generated markup over its (now-real) Sale Price, so the
//    storefront/admin/POS strikethrough-pricing UI has real data to show.
//
// Both passes are scope-limited, not re-run-guarded by a flag: pass 1 only
// touches priceCents = 0 rows, pass 2 only touches compareAtCents IS NULL
// rows, so running this again after staff have set their own real
// prices/Original Price values won't overwrite them.
//
// compareAtCents is a display-only field (see docs/database/schema.md) — it
// is never read by pos.service.js or orders.routes.js when pricing a sale.
// Neither pass writes a PriceHistory row: that table logs real-world
// priceCents *changes* on an already-listed, already-sold product; backfilling
// a placeholder price on a product that has never had one isn't that.
//
// Usage: node packages/database/prisma/backfill-compare-at-prices.js

const { PrismaClient } = require("../generated/client");

const prisma = new PrismaClient();

// Rough, realistic US retail price bands (in whole dollars) per category
// name, used only to backfill variants that currently have no price at all.
// Matches the category set seeded by this repo's demo/import data — falls
// back to GENERIC_RANGE for any category not listed here.
const CATEGORY_PRICE_RANGES = {
  "Reclining Sectionals": [1800, 4200],
  "Recliners & Lift Chairs": [500, 1800],
  "Stationary Sofas & Loveseats": [700, 2200],
  Beds: [400, 1800],
  "Living Room": [300, 2000],
  "Bedroom Furniture": [300, 1600],
  "Stationary Sectionals": [1200, 3200],
  Office: [150, 900],
  "Office & Bookcase": [150, 900],
  "Sleepers & Futons": [600, 1800],
  Bedroom: [300, 1600],
  Dining: [400, 2000],
  "Dining Room Furniture": [400, 2200],
  "Vanities & Mirrors": [150, 800],
  "Home Accessories": [40, 400],
  Accessories: [40, 400],
  Mattresses: [400, 2200],
  "Reclining Sofas & Loveseats": [900, 2600],
  Barstools: [80, 300],
  "Occasional Tables": [150, 700],
  "TV Stands": [200, 900],
  "Bunk Beds": [500, 1800],
  Daybeds: [400, 1400],
};
const GENERIC_RANGE = [200, 1500];

const MIN_MARKUP = 0.1; // Original Price is at least 10% above Sale Price
const MAX_MARKUP = 0.4; // ...and at most 40% above

function randomPriceCentsForCategory(categoryName) {
  const [min, max] = CATEGORY_PRICE_RANGES[categoryName] ?? GENERIC_RANGE;
  const dollars = min + Math.random() * (max - min);
  // Round to a .99 sticker price, matching typical US furniture retail.
  return Math.round(dollars) * 100 - 1;
}

function randomCompareAtCents(priceCents) {
  const markup = MIN_MARKUP + Math.random() * (MAX_MARKUP - MIN_MARKUP);
  const raw = priceCents * (1 + markup);
  // Round to the nearest whole dollar (…99 cents) for a realistic US sticker
  // price like $1,299.00 rather than an odd cents value.
  return Math.round(raw / 100) * 100 - 1;
}

async function backfillSalePrices() {
  const variants = await prisma.variant.findMany({
    where: { priceCents: 0 },
    select: { id: true, sku: true, product: { select: { category: { select: { name: true } } } } },
  });

  if (variants.length === 0) {
    console.log("No variants need a backfilled Sale Price.");
    return;
  }

  console.log(`Backfilling Sale Price for ${variants.length} variant(s) with priceCents = 0...`);
  for (const variant of variants) {
    const priceCents = randomPriceCentsForCategory(variant.product?.category?.name);
    await prisma.variant.update({ where: { id: variant.id }, data: { priceCents } });
    console.log(`  ${variant.sku}: $0.00 -> $${(priceCents / 100).toFixed(2)}`);
  }
}

async function backfillOriginalPrices() {
  const variants = await prisma.variant.findMany({
    where: { compareAtCents: null },
    select: { id: true, sku: true, priceCents: true },
  });

  if (variants.length === 0) {
    console.log("No variants need a backfilled Original Price.");
    return;
  }

  console.log(`Backfilling Original Price for ${variants.length} variant(s)...`);
  for (const variant of variants) {
    const compareAtCents = randomCompareAtCents(variant.priceCents);
    await prisma.variant.update({ where: { id: variant.id }, data: { compareAtCents } });
    console.log(
      `  ${variant.sku}: sale $${(variant.priceCents / 100).toFixed(2)} -> original $${(compareAtCents / 100).toFixed(2)}`
    );
  }
}

async function main() {
  await backfillSalePrices();
  // Original Price always derives from whatever Sale Price ends up being —
  // run second so a variant backfilled in pass 1 gets a correct markup
  // instead of a markup over the stale $0 price.
  await backfillOriginalPrices();
  console.log("Backfill complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
