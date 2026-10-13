import Link from "next/link";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ProductCard from "@/components/home/ProductCard";
import CategoryCard from "@/components/home/CategoryCard";
import { categories } from "@/lib/mock-data/categories";
import { products } from "@/lib/mock-data/products";

export const metadata = {
  title: "Shop All Furniture | Big Ed's Sofas & Beds",
  description:
    "Browse every category at Big Ed's Sofas & Beds — sofas, sectionals, recliners, bedroom sets, mattresses and dining sets.",
};

export default function ShopAllPage() {
  return (
    <div className="py-8 sm:py-10">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop All" }]} />

        <div className="mt-4 flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-brand-charcoal sm:text-4xl">
            Shop All Furniture
          </h1>
          <p className="max-w-2xl text-sm text-brand-charcoal/70 sm:text-base">
            Quality furniture for every room, at prices built for real budgets. Browse by category
            below, or scroll through our full product lineup.
          </p>
        </div>

        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold text-brand-charcoal">Shop by Category</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-brand-charcoal">All Products</h2>
            <Link href="/deals" className="text-sm font-semibold text-brand-red-dark hover:underline">
              View Deals
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
