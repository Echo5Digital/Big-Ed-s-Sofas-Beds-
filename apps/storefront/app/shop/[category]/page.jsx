// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import { notFound } from "next/navigation";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import PageHero from "@/components/ui/PageHero";
import ProductCard from "@/components/home/ProductCard";
import CategoryCard from "@/components/home/CategoryCard";
import { getCategories, getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

// 20 per page, laid out 4 columns x 5 rows on desktop (see the grid below) —
// matches /shop's pagination.
const PAGE_SIZE = 20;

// Resolves a /shop/[category] slug against the live category list. Supports
// nested categories (via Category.parentId) transparently: a parent slug
// shows its children as sub-category links, a leaf slug shows its own
// products directly — today's seed data is flat (no parent/child relations
// set), so every slug currently behaves as a leaf category page.
async function resolveCategory(slug, page) {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;

  const children = categories.filter((c) => c.parentId === category.id);
  const { products, pagination } = await getProducts({ category: slug, page, pageSize: PAGE_SIZE });

  return { category, children, products, pagination };
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

export default async function ShopCategoryPage({ params, searchParams }) {
  const { category: slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const resolved = await resolveCategory(slug, page);

  if (!resolved) {
    notFound();
  }

  const { category, children, products: rawProducts, pagination } = resolved;
  const products = rawProducts.map(normalizeProductForCard);
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const allCategories = await getCategories();

  return (
    <div className="pb-10">
      <PageHero title={category.name} />

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

        <div className="mt-8">
          {products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} basePath={`/shop/${category.slug}`} />
            </>
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

        {children.length === 0 && (
          <div className="mt-12">
            <h2 className="font-display text-lg font-semibold text-brand-charcoal">
              Explore More Categories
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {allCategories
                .filter((c) => c.slug !== category.slug)
                .slice(0, 6)
                .map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
