import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/home/ProductCard";
import { getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

const FEATURED_COUNT = 6;

export default async function FeaturedProducts() {
  const { products: rawProducts } = await getProducts({ pageSize: FEATURED_COUNT });
  const featured = rawProducts.map(normalizeProductForCard);

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
