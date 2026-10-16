import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/home/ProductCard";
import { normalizeProductForCard } from "@/lib/api/normalize";

export const FEATURED_COUNT = 6;

// Platform Bed Frame has no product photography yet (see
// docs/requirements/open-questions.md — "Blocks: Real catalog data"), so it's
// excluded from this curated homepage row until a photo is supplied. The
// page fetches a few extra (see app/page.jsx) to backfill the slot without
// starving the grid.
const EXCLUDED_SLUGS = new Set(["platform-bed-frame"]);
export const EXCLUDED_SLUG_COUNT = EXCLUDED_SLUGS.size;

// Takes already-fetched products (see app/page.jsx) so the homepage can
// fetch this and CategoryGrid's data concurrently instead of waterfalling.
export default function FeaturedProducts({ products: rawProducts }) {
  const featured = rawProducts
    .filter((p) => !EXCLUDED_SLUGS.has(p.slug))
    .slice(0, FEATURED_COUNT)
    .map(normalizeProductForCard);

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

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </Container>
    </section>
  );
}
