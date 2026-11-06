import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/home/ProductCard";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { withHomepageAccents } from "@/lib/dailyRotation";

// 4 columns x 2 rows on desktop (see the grid below) — bigger cards than the
// previous 6-column layout, shown deliberately as two full 4-wide rows
// rather than a stray partial row.
export const FEATURED_COUNT = 8;

// Platform Bed Frame has no product photography yet (see
// docs/requirements/open-questions.md — "Blocks: Real catalog data"), so it's
// excluded from this curated homepage row until a photo is supplied.
const EXCLUDED_SLUGS = new Set(["platform-bed-frame"]);
export const EXCLUDED_SLUG_COUNT = EXCLUDED_SLUGS.size;

// Takes an already-selected (see pickDailyDiverse in app/page.jsx), already
// day-rotated list of products spanning every category, not just the
// newest-added ones.
export default function FeaturedProducts({ products: rawProducts }) {
  const featured = rawProducts
    .filter((p) => !EXCLUDED_SLUGS.has(p.slug))
    .map(normalizeProductForCard)
    .map(withHomepageAccents);

  return (
    <section className="bg-brand-cream py-12 sm:py-16">
      <Container>
        <SectionHeading
          title="Featured Furniture"
          subtitle="Stylish looks. Everyday comfort. Great prices."
          action={
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              View All Products
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />

        <div className="mt-6 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} showRatingValue />
          ))}
        </div>
      </Container>
    </section>
  );
}
