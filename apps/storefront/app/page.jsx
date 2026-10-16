// The homepage's category list and featured-product teaser tolerate up to a
// minute of staleness (see the 60s revalidate below) — unlike /shop, product
// detail, cart, and checkout, which stay fully live because stock/price must
// be accurate at purchase intent. See docs/architecture/overview.md for the
// Cache Components tradeoff.
const HOMEPAGE_REVALIDATE_SECONDS = 60;

import HeroBanner from "@/components/home/HeroBanner";
import CategoryGrid from "@/components/home/CategoryGrid";
import FeaturedProducts, { FEATURED_COUNT, EXCLUDED_SLUG_COUNT } from "@/components/home/FeaturedProducts";
import DealsBanner from "@/components/home/DealsBanner";
import BenefitsSection from "@/components/home/BenefitsSection";
import ShowroomSection from "@/components/home/ShowroomSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FinancingBanner from "@/components/home/FinancingBanner";
import NewsletterSignup from "@/components/home/NewsletterSignup";
import { getCategories, getProducts } from "@/lib/api/catalog";

export default async function HomePage() {
  // Fetched together (not awaited one-after-another in each component) so
  // the two independent API calls run concurrently instead of waterfalling.
  const [categories, { products: rawProducts }] = await Promise.all([
    getCategories({ next: { revalidate: HOMEPAGE_REVALIDATE_SECONDS } }),
    getProducts({
      pageSize: FEATURED_COUNT + EXCLUDED_SLUG_COUNT,
      next: { revalidate: HOMEPAGE_REVALIDATE_SECONDS },
    }),
  ]);

  return (
    <>
      <HeroBanner />
      <CategoryGrid categories={categories} />
      <FeaturedProducts products={rawProducts} />
      <DealsBanner />
      <BenefitsSection />
      <ShowroomSection />
      <TestimonialsSection />
      <FinancingBanner />
      <NewsletterSignup />
    </>
  );
}
