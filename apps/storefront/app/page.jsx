// The homepage's category list and featured-product teaser tolerate a few
// minutes of staleness (see getHomepageData's cacheLife below) — unlike
// /shop, product detail, cart, and checkout, which stay fully live because
// stock/price must be accurate at purchase intent. See
// docs/architecture/overview.md for the Cache Components tradeoff. The
// Featured Furniture / Trending Now picks additionally rotate once every 24h
// (see lib/dailyRotation.js) independent of this cache window — a cache hit
// just means "today"'s already-computed pick is served without refetching;
// it doesn't change which products get picked.

// Pulled from every active category (not paged down to just the newest
// products) so there's a real pool for pickDailyDiverse to spread across.
// 100 is the API's hard per-request cap (see apps/api/src/routes/catalog.routes.js).
const PRODUCT_POOL_SIZE = 100;

import { cacheLife } from "next/cache";
import HeroBanner from "@/components/home/HeroBanner";
import TrustStrip from "@/components/home/TrustStrip";
import FeaturedProducts, { FEATURED_COUNT } from "@/components/home/FeaturedProducts";
import CategorySpotlight, { SPOTLIGHT_COUNT } from "@/components/home/CategorySpotlight";
import DealsBanner from "@/components/home/DealsBanner";
import DoorbusterDeals from "@/components/home/DoorbusterDeals";
import BenefitsSection from "@/components/home/BenefitsSection";
import ShowroomSection from "@/components/home/ShowroomSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import { getProducts, getProductBySlug } from "@/lib/api/catalog";
import { pickDailyDiverse, shuffleProducts } from "@/lib/dailyRotation";
import { currentDaySeed } from "@/lib/currentDaySeed";
import { getDoorbusterDeals } from "@/lib/doorbusterDeals";
import { RECENT_PRICE_UPDATE_SLUGS } from "@/lib/recentPriceUpdateSlugs";

// Pool for the Deals carousel — fetched separately from PRODUCT_POOL_SIZE's
// everything-pool above since it needs the deals: true filter (only
// staff-flagged markdowns, same gate /deals itself uses — see
// apps/api/src/routes/catalog.routes.js), not a sample of the whole catalog.
const DEALS_POOL_SIZE = 20;

// Cache Components requires any fetch a route wants prerendered to be
// explicitly marked cacheable (plain `fetch(...)`, even with
// `next.revalidate` set, doesn't count — see the "[cache]" fix in the
// "Next.js encountered uncached or runtime data during prerendering" build
// error this used to throw before this wrapper existed). Scoped to the
// homepage only: other pages (`/shop`, product detail, search) call
// getCategories/getProducts directly and must stay fully live.
async function getHomepageData() {
  "use cache";
  cacheLife("minutes");
  return Promise.all([
    getProducts({ pageSize: PRODUCT_POOL_SIZE }),
    getProducts({ pageSize: DEALS_POOL_SIZE, sort: "oldest", deals: true }),
  ]);
}

// Fetches getProductBySlug for every slug in `slugs`, but only
// `concurrency`-at-a-time — 60+ simultaneous requests (this list's size)
// would otherwise burst well past the API's DB connection pool limit (see
// packages/database's Prisma client config), unlike doorbusterDeals.js's
// same fetch-by-slug pattern, which only ever fires 7 at once.
async function fetchProductsBySlug(slugs, concurrency = 8) {
  const results = new Array(slugs.length).fill(null);
  let failures = 0;
  let firstError = null;

  let cursor = 0;
  async function worker() {
    while (cursor < slugs.length) {
      const index = cursor++;
      try {
        results[index] = await getProductBySlug(slugs[index]);
      } catch (error) {
        if (error?.status !== 404) {
          failures += 1;
          firstError ??= error;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, slugs.length) }, worker));

  if (failures === slugs.length) throw firstError;
  return results;
}

// Featured Furniture / Trending Now draw from this recently price-updated
// set (see recentPriceUpdateSlugs.js) rather than the generic PRODUCT_POOL_SIZE
// sample above — fetched directly by slug (same pattern as
// getDoorbusterDeals in lib/doorbusterDeals.js) since most of these 60+
// products wouldn't reliably land inside an arbitrary 100-item page out of
// the full ~735-product catalog. A missing/renamed slug (404) is silently
// dropped rather than failing the whole homepage; any other error still
// throws so the section fails the same way the rest of the homepage does
// when the API is unreachable.
async function getRecentPriceUpdatePool() {
  "use cache";
  cacheLife("minutes");

  const products = await fetchProductsBySlug(RECENT_PRICE_UPDATE_SLUGS);
  return products.filter((p) => p && p.status === "ACTIVE");
}

export default async function HomePage() {
  // The hand-picked doorbuster products are fetched alongside the product
  // pools rather than after them.
  const [[{ products: productPool }, { products: dealsPool }], doorbusterDeals, recentPriceUpdatePool] =
    await Promise.all([getHomepageData(), getDoorbusterDeals(), getRecentPriceUpdatePool()]);

  const seed = await currentDaySeed();

  // Falls back to the generic pool if the recently-price-updated set comes
  // back empty (e.g. every slug in the list got renamed/archived), so the
  // homepage never renders blank Featured/Trending sections.
  const featuredPool = recentPriceUpdatePool.length > 0 ? recentPriceUpdatePool : productPool;

  const featuredProducts = pickDailyDiverse(featuredPool, FEATURED_COUNT, seed);
  const spotlightProducts = pickDailyDiverse(
    featuredPool,
    SPOTLIGHT_COUNT,
    seed,
    new Set(featuredProducts.map((p) => p.id))
  );
  const deals = shuffleProducts(dealsPool, seed, "home-deals");

  return (
    <>
      <HeroBanner />
      <TrustStrip />
      <FeaturedProducts products={featuredProducts} />
      <DealsBanner deals={deals} />
      <DoorbusterDeals deals={doorbusterDeals} />
      <BenefitsSection />
      <CategorySpotlight
        products={spotlightProducts}
        title="Trending Now"
        subtitle="A fresh mix handpicked from across the store."
      />
      <ShowroomSection />
      <TestimonialsSection />
    </>
  );
}
