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
import BenefitsSection from "@/components/home/BenefitsSection";
import ShowroomSection from "@/components/home/ShowroomSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import NewsletterSignup from "@/components/home/NewsletterSignup";
import { getProducts } from "@/lib/api/catalog";
import { pickDailyDiverse, shuffleProducts } from "@/lib/dailyRotation";
import { currentDaySeed } from "@/lib/currentDaySeed";

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

export default async function HomePage() {
  const [{ products: productPool }, { products: dealsPool }] = await getHomepageData();

  const seed = await currentDaySeed();
  const featuredProducts = pickDailyDiverse(productPool, FEATURED_COUNT, seed);
  const spotlightProducts = pickDailyDiverse(
    productPool,
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
      <BenefitsSection />
      <CategorySpotlight
        products={spotlightProducts}
        title="Trending Now"
        subtitle="A fresh mix handpicked from across the store."
      />
      <ShowroomSection />
      <TestimonialsSection />
      <NewsletterSignup />
    </>
  );
}
