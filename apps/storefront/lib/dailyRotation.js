// Deterministic "pick N products, rotate every 24h, spread across
// categories" used by the homepage's Featured Furniture and Trending Now
// sections. No new DB field/cron needed: the selection is a pure function of
// (product pool, calendar day), so ISR (see HOMEPAGE_REVALIDATE_SECONDS in
// app/page.jsx) just needs to re-render at least once a day for the picks to
// change on their own — every page render on the same UTC day is stable.

import { cacheLife } from "next/cache";

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

// Applies the homepage-only "Sale" tag + decorative rating on top of an
// already-normalized card (see normalizeProductForCard) without touching the
// shared normalizer other pages (/shop, product detail, search, wishlist)
// rely on for their real badge/rating behavior (OUT OF STOCK, null rating).
export function withHomepageAccents(product) {
  return {
    ...product,
    badge: product.badge ?? "SALE",
    rating: homepageDisplayRating(product.id),
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

// Whole calendar day (UTC) since the epoch — increments once every 24h, so a
// selection made with this as part of the seed is stable for a day and
// changes the next. Reading Date.now() directly in a Server Component is a
// build error under this app's cacheComponents config ("Next.js encountered
// the unstable value Date.now() while prerendering") since it's normally a
// sign of a value that can't be cached at all. "use cache" + cacheLife here
// tells Next the opposite is true: this value is fine to cache, just only
// for a day, which is exactly the rotation period we want — so it composes
// with the page's own 60s ISR revalidate instead of forcing the whole
// homepage dynamic.
export async function currentDaySeed() {
  "use cache";
  cacheLife("days");
  return Math.floor(Date.now() / 86_400_000);
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
