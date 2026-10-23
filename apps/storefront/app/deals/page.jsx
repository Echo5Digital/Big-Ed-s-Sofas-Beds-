// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import Link from "next/link";
import { Tag } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import PageHero from "@/components/ui/PageHero";
import ProductCard from "@/components/home/ProductCard";
import { getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

export const metadata = {
  title: "Deals | Big Ed's Sofas & Beds",
  description: "Shop the best current markdowns on sofas, mattresses, bedroom sets and dining sets at Big Ed's Sofas & Beds.",
};

const FILTER_TABS = [
  { key: null, label: "All Deals" },
  { key: "new-arrivals", label: "New Arrivals" },
  { key: "closeout", label: "Closeout Specials" },
];

const NEW_ARRIVALS_LIMIT = 24;

export default async function DealsPage({ searchParams }) {
  const { filter } = await searchParams;
  const { products: rawProducts } = await getProducts({ pageSize: 100, sort: "oldest" });
  const allProducts = rawProducts.map(normalizeProductForCard);

  let deals = allProducts.filter((p) => p.compareAtPrice);
  if (filter === "new-arrivals") {
    deals = allProducts
      .filter((p) => p.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, NEW_ARRIVALS_LIMIT);
  } else if (filter === "closeout") {
    deals = allProducts.filter((p) => p.compareAtPrice);
  }

  return (
    <div className="pb-10">
      <PageHero
        title="UnBEARably Good Deals"
        subtitle="Real markdowns on in-stock furniture — no gimmicks, just big savings while supplies last."
        mascotPose="thumbsup"
      />

      <Container className="mt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Deals" }]} />

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const isActive = (filter ?? null) === tab.key;
            return (
              <Link
                key={tab.label}
                href={tab.key ? `/deals?filter=${tab.key}` : "/deals"}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-brand-charcoal/15 bg-white text-brand-charcoal hover:border-brand-red hover:text-brand-red-dark"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-6">
          {deals.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {deals.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Tag}
              title="No active deals right now"
              description="Check back soon — new markdowns are added regularly. In the meantime, browse our full catalog."
              actionLabel="Shop All Furniture"
              actionHref="/shop"
            />
          )}
        </div>
      </Container>
    </div>
  );
}
