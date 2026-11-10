// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import ShopPageHero from "@/components/ui/ShopPageHero";
import ProductGridWithControls from "@/components/shop/ProductGridWithControls";
import { getAllProducts, getCategories } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { shuffleProducts, withDisplayRating } from "@/lib/dailyRotation";
import { currentDaySeed } from "@/lib/currentDaySeed";

export const metadata = {
  title: "Shop All Furniture | Big Ed's Sofas & Beds",
  description:
    "Browse every category at Big Ed's Sofas & Beds — sofas, sectionals, recliners, bedroom sets, mattresses and dining sets.",
};

// Same full-catalog-plus-sidebar-filters treatment as /shop/[category] (see
// that page and components/shop/ProductGridWithControls.jsx) instead of the
// previous curated per-category row teaser — fetches every ACTIVE product
// site-wide (getAllProducts with no category) so the price/material/color/
// in-stock filters and sort correctly reach every product in the catalog,
// not just a sampled handful per category.
export default async function ShopAllPage() {
  const [{ products: rawProducts }, categories, seed] = await Promise.all([
    getAllProducts({ sort: "oldest" }),
    getCategories(),
    currentDaySeed(),
  ]);
  const products = shuffleProducts(rawProducts, seed, "shop-all")
    .map(normalizeProductForCard)
    .map(withDisplayRating);

  return (
    <div className="pb-10">
      <ShopPageHero
        title="Shop All Furniture"
        subtitle="Quality furniture for every room, at prices built for real budgets."
      />

      <Container className="mt-8">
        <div className="flex items-center justify-end gap-4">
          <Link href="/deals" className="text-sm font-semibold text-brand-red-dark hover:underline">
            View Deals
          </Link>
        </div>

        <div className="mt-6">
          {products.length > 0 ? (
            <ProductGridWithControls products={products} categories={categories} />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="No products found yet"
              description="We're still stocking the catalog online. Check back soon."
              actionLabel="View Deals"
              actionHref="/deals"
            />
          )}
        </div>
      </Container>
    </div>
  );
}
