// Deterministic "pick N products, rotate every 24h, spread across
// categories" used by the homepage's Featured Furniture and Trending Now
// sections. No new DB field/cron needed: the selection is a pure function of
// (product pool, calendar day), so ISR (see HOMEPAGE_REVALIDATE_SECONDS in
// app/page.jsx) just needs to re-render at least once a day for the picks to
// change on their own — every page render on the same UTC day is stable.
//
// currentDaySeed() lives in lib/currentDaySeed.js, not here — it needs
// "use cache"/cacheLife (next/cache), which is Server-Component-only, and
// this module must stay importable from Client Components too (see
// app/wishlist/page.jsx, which uses shuffleProducts below).

// mulberry32 — small, fast, deterministic PRNG. Math.random() is intentionally
// never used here: the whole point is that the same (seed) input always
// produces the same shuffle within a given day, across concurrent requests
// and server instances.
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple string hash (djb2) — turns a product id into a numeric seed so each
// product gets its own stable PRNG stream, independent of mulberry32's own
// integer seed used for shuffling.
function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
}

// Homepage-only decorative rating (see FeaturedProducts/CategorySpotlight) —
// not backed by real reviews, same spirit as the disclosed fictional
// testimonials in lib/mock-data/testimonials.js. Deterministic per product id
// so the same product always shows the same rating across renders/sections
// instead of flickering on every request. Always falls in [4.5, 5.0].
export function homepageDisplayRating(productId) {
  const rand = mulberry32(hashString(productId));
  const rating = 4.5 + rand() * 0.5;
  return Math.round(rating * 10) / 10;
}

// Decorative review count paired with homepageDisplayRating above — same
// "not backed by real reviews" disclosure applies. A different hash salt
// than homepageDisplayRating so the two don't move in lockstep (e.g. every
// 4.9 getting the same count). Falls in [8, 400], skewed toward the lower
// end (squared) so most products look newly-reviewed rather than all
// clustering near 400.
export function homepageDisplayReviewCount(productId) {
  const rand = mulberry32(hashString(`reviews:${productId}`));
  return Math.round(8 + rand() * rand() * 392);
}

// Applies the homepage-only "Sale" tag + decorative rating on top of an
// already-normalized card (see normalizeProductForCard) without touching the
// shared normalizer other pages (/shop, product detail, search, wishlist)
// rely on for their real badge/rating behavior (OUT OF STOCK, null rating).
export function withHomepageAccents(product) {
  return {
    ...product,
    badge: product.badge ?? "SALE",
    rating: homepageDisplayRating(product.id),
    reviewCount: homepageDisplayReviewCount(product.id),
  };
}

// Same decorative rating/review treatment as withHomepageAccents, minus the
// "Sale" badge override — used on /shop, /shop/[category], and the product
// detail page's related-product rows, which should keep their real
// OUT OF STOCK badge (from normalizeProductForCard) rather than always
// claiming SALE.
export function withDisplayRating(product) {
  return {
    ...product,
    rating: homepageDisplayRating(product.id),
    reviewCount: homepageDisplayReviewCount(product.id),
  };
}

function seededShuffle(items, seed) {
  const rand = mulberry32(seed);
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Listing pages (/shop, /shop/[category], /deals, /wishlist, PDP "You May
// Also Like") previously requested `sort: "oldest"` from the API, which is
// literally database insertion order (apps/api/src/routes/catalog.routes.js
// maps it to `orderBy: { createdAt: "asc" }`) — every visit showed the exact
// same first-added-first sequence, making older stock look permanently
// "featured" over newer arrivals. This reshuffles a full product array using
// the same deterministic PRNG as the homepage's rotation (seededShuffle +
// currentDaySeed above), salted per call site (`seedSalt`) so /shop and, say,
// /shop/living-room don't happen to produce visibly-correlated orderings from
// sharing the same day seed. Deterministic per (day, salt) — not
// re-randomized on every request — so pagination and "page 2 still has what
// I expect" stay stable within a single day; it changes again the next day,
// same rotation cadence as the homepage sections.
export function shuffleProducts(products, daySeed, seedSalt = "") {
  return seededShuffle(products, daySeed + hashString(seedSalt));
}

// Picks `count` products out of `pool`, favoring variety across categories:
// groups by category, deterministically shuffles the category order and each
// category's products (both keyed off `seed`), then round-robins one product
// per category per pass so the result isn't dominated by whichever category
// happens to have the most products. Pass `exclude` (a Set of product ids) to
// get a disjoint pick for a second section drawing from the same pool.
export function pickDailyDiverse(pool, count, seed, exclude) {
  const candidates = exclude ? pool.filter((p) => !exclude.has(p.id)) : pool;

  const byCategory = new Map();
  for (const product of candidates) {
    const key = product.category?.id ?? product.categoryId ?? "uncategorized";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(product);
  }

  const categoryKeys = seededShuffle([...byCategory.keys()], seed);
  const queues = categoryKeys.map((key) => seededShuffle(byCategory.get(key), seed + 1));

  const picked = [];
  let round = 0;
  while (picked.length < count) {
    const queuesWithRemaining = queues.some((q) => round < q.length);
    if (!queuesWithRemaining) break;
    for (const queue of queues) {
      if (round < queue.length) {
        picked.push(queue[round]);
        if (picked.length === count) break;
      }
    }
    round += 1;
  }

  return picked;
}
