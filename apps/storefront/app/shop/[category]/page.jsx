import { notFound } from "next/navigation";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import ProductCard from "@/components/home/ProductCard";
import CategoryCard from "@/components/home/CategoryCard";
import { resolveShopSlug, getAllShopSlugs } from "@/lib/shop";
import { categories } from "@/lib/mock-data/categories";

export function generateStaticParams() {
  return getAllShopSlugs().map((category) => ({ category }));
}

export async function generateMetadata({ params }) {
  const { category: slug } = await params;
  const category = resolveShopSlug(slug);
  if (!category) {
    return { title: "Category Not Found | Big Ed's Sofas & Beds" };
  }
  return {
    title: `${category.name} | Big Ed's Sofas & Beds`,
    description: category.description,
  };
}

export default async function ShopCategoryPage({ params }) {
  const { category: slug } = await params;
  const category = resolveShopSlug(slug);

  if (!category) {
    notFound();
  }

  return (
    <div className="py-8 sm:py-10">
      <Container>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Shop All", href: "/shop" }, { label: category.name }]}
        />

        <div className="mt-4 flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-brand-charcoal sm:text-4xl">
            {category.name}
          </h1>
          <p className="max-w-2xl text-sm text-brand-charcoal/70 sm:text-base">{category.description}</p>
        </div>

        {category.subCategories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {category.subCategories.map((sub) => (
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
          {category.products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
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

        {category.subCategories.length === 0 && (
          <div className="mt-12">
            <h2 className="font-display text-lg font-semibold text-brand-charcoal">
              Explore More Categories
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {categories
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
