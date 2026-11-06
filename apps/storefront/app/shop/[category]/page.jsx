// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import { notFound } from "next/navigation";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import ShopPageHero from "@/components/ui/ShopPageHero";
import ProductGridWithControls from "@/components/shop/ProductGridWithControls";
import { getCategories, getAllProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { shuffleProducts, withDisplayRating } from "@/lib/dailyRotation";
import { currentDaySeed } from "@/lib/currentDaySeed";

// Resolves a /shop/[category] slug against the live category list. Supports
// nested categories (via Category.parentId) transparently: a parent slug
// shows its children as sub-category links, a leaf slug shows its own
// products directly — today's seed data is flat (no parent/child relations
// set), so every slug currently behaves as a leaf category page.
//
// Fetches every product in the category (getAllProducts loops the API's
// paginated endpoint), not just one page of it — the sidebar filters
// (price/material/color/in-stock) and sort in ProductGridWithControls need
// the complete set to work correctly; pagination now happens client-side,
// over the filtered result, instead of being a server-side page boundary a
// filter could never see past.
async function resolveCategory(slug) {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;

  const children = categories.filter((c) => c.parentId === category.id);
  const { products } = await getAllProducts({ category: slug, sort: "oldest" });

  return { category, children, products };
}

export async function generateMetadata({ params }) {
  const { category: slug } = await params;
  const resolved = await resolveCategory(slug);
  if (!resolved) {
    return { title: "Category Not Found | Big Ed's Sofas & Beds" };
  }
  return {
    title: `${resolved.category.name} | Big Ed's Sofas & Beds`,
  };
}

export default async function ShopCategoryPage({ params }) {
  const { category: slug } = await params;
  const resolved = await resolveCategory(slug);

  if (!resolved) {
    notFound();
  }

  const { category, children, products: rawProducts } = resolved;
  const seed = await currentDaySeed();
  const products = shuffleProducts(rawProducts, seed, `category-${slug}`)
    .map(normalizeProductForCard)
    .map(withDisplayRating);

  return (
    <div className="pb-10">
      <ShopPageHero title={category.name} />

      <Container className="mt-8">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Shop All", href: "/shop" }, { label: category.name }]}
        />

        {children.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {children.map((sub) => (
              <Link
                key={sub.slug}
                href={`/shop/${sub.slug}`}
                className="rounded-full border border-brand-charcoal/15 bg-white px-4 py-2 text-sm font-semibold text-brand-charcoal hover:border-brand-red hover:text-brand-red-dark"
              >
                {sub.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">
          {products.length > 0 ? (
            <ProductGridWithControls products={products} />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="No products found in this category yet"
              description="We're still stocking this category online. Check back soon, or browse all furniture in the meantime."
              actionLabel="Shop All Furniture"
              actionHref="/shop"
            />
          )}
        </div>
      </Container>
    </div>
  );
}
