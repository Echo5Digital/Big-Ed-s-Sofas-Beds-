// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import { notFound } from "next/navigation";
import { PackageSearch } from "lucide-react";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import ShopPageHero from "@/components/ui/ShopPageHero";
import ProductGridWithControls from "@/components/shop/ProductGridWithControls";
import { getCategories, getAllProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { shuffleProducts, withDisplayRating } from "@/lib/dailyRotation";
import { currentDaySeed } from "@/lib/currentDaySeed";

// Only these top-level categories get a sub-category filter in the sidebar
// (Office and Accessories each have just one trivial catch-all child, so a
// sub-category filter for them would be pointless — confirmed product
// decision).
const CATEGORY_FILTER_PARENT_SLUGS = ["living-room", "bedroom", "dining"];

// Resolves a /shop/[category] slug against the live category list. Categories
// are a real two-level tree (Category.parentId, seeded in
// packages/database/prisma/seed.js — e.g. Living Room -> Stationary Sofas &
// Loveseats, Sectionals, Recliners, etc.): a parent slug rolls up every
// product from its sub-categories too (a product tagged only to "Stationary
// Sofas & Loveseats" still shows up on /shop/living-room), not just products
// tagged directly to the parent itself — matching the same rollup behavior as
// the /shop page's category filter (see
// components/shop/ProductGridWithControls.jsx). A leaf slug (no children)
// shows only its own directly-tagged products, same as before.
//
// Fetches every product across the category (+ children, for a parent) via
// getAllProducts (loops the API's paginated endpoint per slug), not just one
// page of it — the sidebar filters (price/material/color/in-stock) and sort
// in ProductGridWithControls need the complete set to work correctly;
// pagination happens client-side, over the filtered result.
async function resolveCategory(slug) {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;

  const children = categories.filter((c) => c.parentId === category.id);
  const slugsToFetch = [slug, ...children.map((c) => c.slug)];

  const results = await Promise.all(
    slugsToFetch.map((s) => getAllProducts({ category: s, sort: "oldest" }))
  );
  // A product tagged to BOTH the parent and one of its children (via primary
  // + secondary category tags) would otherwise appear twice once their
  // product lists are merged.
  const seenIds = new Set();
  const products = results
    .flatMap((r) => r.products)
    .filter((p) => (seenIds.has(p.id) ? false : (seenIds.add(p.id), true)));

  // Scoped down to just this parent + its own children — ProductGridWithControls
  // builds a Category filter tree from whatever `categories` it's given (see
  // buildCategoryTree in lib/categoryTree.js), so passing the full site-wide
  // list here would surface every other room's categories too. Only built for
  // the rooms in CATEGORY_FILTER_PARENT_SLUGS; everywhere else this stays
  // empty and ProductGridWithControls's Category filter section doesn't render
  // (same as /shop/[category] behaved before this filter existed).
  const categoriesForFilter = CATEGORY_FILTER_PARENT_SLUGS.includes(slug) ? [category, ...children] : [];

  return { category, children, products, categoriesForFilter };
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

  const { category, products: rawProducts, categoriesForFilter } = resolved;
  const seed = await currentDaySeed();
  const products = shuffleProducts(rawProducts, seed, `category-${slug}`)
    .map(normalizeProductForCard)
    .map(withDisplayRating);

  return (
    <div className="pb-10">
      <ShopPageHero title={category.name} />

      <Container className="mt-8">
        <div className="mt-6">
          {products.length > 0 ? (
            <ProductGridWithControls
              products={products}
              categories={categoriesForFilter}
              hideParentCategoryCheckbox={CATEGORY_FILTER_PARENT_SLUGS.includes(slug)}
            />
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
