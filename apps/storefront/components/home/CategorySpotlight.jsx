import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/home/ProductCard";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { withHomepageAccents } from "@/lib/dailyRotation";

export const SPOTLIGHT_COUNT = 6;

// A second, smaller homepage product row — distinct from Featured Furniture
// both in heading and in which products it shows (see app/page.jsx, which
// excludes Featured's picks before selecting these). Reuses ProductCard/
// normalizeProductForCard rather than duplicating card markup.
export default function CategorySpotlight({ products, title, subtitle }) {
  const spotlight = products.map(normalizeProductForCard).map(withHomepageAccents);

  if (spotlight.length === 0) return null;

  return (
    <section className="bg-white py-12 sm:py-16">
      <Container>
        <SectionHeading
          title={title}
          subtitle={subtitle}
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
          {spotlight.map((product) => (
            <ProductCard key={product.id} product={product} showRatingValue />
          ))}
        </div>
      </Container>
    </section>
  );
}
