// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import Link from "next/link";
import { Tag } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import ProductCard from "@/components/home/ProductCard";
import BearMascot from "@/components/ui/BearMascot";
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
  const { products: rawProducts } = await getProducts({ pageSize: 100 });
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
      <section className="bg-gradient-to-r from-brand-red-dark via-brand-red to-brand-red-dark py-10 sm:py-12">
        <Container className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <BearMascot className="h-24 w-24 shrink-0 drop-shadow-xl sm:h-28 sm:w-28" pose="thumbsup" />
          <div>
            <h1 className="font-display text-stroke-dark text-3xl font-bold leading-[1.05] text-brand-gold drop-shadow-[0_3px_0_rgba(0,0,0,0.3)] sm:text-4xl">
              UnBEARably Good Deals
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
              Real markdowns on in-stock furniture — no gimmicks, just big savings while supplies
              last.
            </p>
          </div>
        </Container>
      </section>

      <Container className="mt-8 sm:mt-10">
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
