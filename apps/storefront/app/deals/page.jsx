// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

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

export default async function DealsPage() {
  const { products: rawProducts } = await getProducts({ pageSize: 100, sort: "oldest" });
  const allProducts = rawProducts.map(normalizeProductForCard);

  const deals = allProducts.filter((p) => p.isDeal || p.compareAtPrice);

  return (
    <div className="pb-10">
      <PageHero
        title="UnBEARably Good Deals"
        subtitle="Real markdowns on in-stock furniture — no gimmicks, just big savings while supplies last."
        mascotPose="thumbsup"
      />

      <Container className="mt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Deals" }]} />

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
