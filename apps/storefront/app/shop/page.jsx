// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import Link from "next/link";
import { ArrowRight, PackageSearch } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import PageHero from "@/components/ui/PageHero";
import SectionHeading from "@/components/ui/SectionHeading";
import ProductCard from "@/components/home/ProductCard";
import { getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

// Mirrors the homepage's "Shop by Category" teaser and the top nav's five
// top-level categories — see components/home/CategoryGrid.jsx and
// packages/database/prisma/seed.js's categoryGroupDefs.
const SECTIONS = [
  { slug: "living-room", label: "Living Room" },
  { slug: "bedroom", label: "Bedroom" },
  { slug: "dining", label: "Dining" },
  { slug: "office", label: "Office" },
  { slug: "accessories", label: "Accessories" },
];

const PRODUCTS_PER_SECTION = 8;
// Pool size to draw the random 8 from — large enough to give a real shuffle
// across a category's catalog without fetching every product in it.
const SECTION_FETCH_POOL = 40;

function pickRandom(items, count) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export const metadata = {
  title: "Shop All Furniture | Big Ed's Sofas & Beds",
  description:
    "Browse every category at Big Ed's Sofas & Beds — sofas, sectionals, recliners, bedroom sets, mattresses and dining sets.",
};

export default async function ShopAllPage() {
  const sections = await Promise.all(
    SECTIONS.map(async ({ slug, label }) => {
      const { products: rawProducts } = await getProducts({ category: slug, pageSize: SECTION_FETCH_POOL });
      const products = pickRandom(rawProducts, PRODUCTS_PER_SECTION).map(normalizeProductForCard);
      return { slug, label, products };
    })
  );

  const hasAnyProducts = sections.some((section) => section.products.length > 0);

  return (
    <div className="pb-10">
      <PageHero
        title="Shop All Furniture"
        subtitle="Quality furniture for every room, at prices built for real budgets."
      />

      <Container className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop All" }]} />
          <Link href="/deals" className="text-sm font-semibold text-brand-red-dark hover:underline">
            View Deals
          </Link>
        </div>

        {hasAnyProducts ? (
          <div className="mt-8 flex flex-col gap-12">
            {sections
              .filter((section) => section.products.length > 0)
              .map((section) => (
                <section key={section.slug} aria-label={section.label}>
                  <SectionHeading
                    title={section.label}
                    action={
                      <Link
                        href={`/shop/${section.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
                      >
                        View All
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    }
                  />
                  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {section.products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={PackageSearch}
              title="No products found yet"
              description="We're still stocking the catalog online. Check back soon."
              actionLabel="View Deals"
              actionHref="/deals"
            />
          </div>
        )}
      </Container>
    </div>
  );
}
