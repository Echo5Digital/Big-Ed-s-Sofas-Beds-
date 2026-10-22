// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import Link from "next/link";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Pagination from "@/components/ui/Pagination";
import PageHero from "@/components/ui/PageHero";
import ProductCard from "@/components/home/ProductCard";
import { getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

// 20 per page, laid out 4 columns x 5 rows on desktop (see the grid below).
const PAGE_SIZE = 20;

export const metadata = {
  title: "Shop All Furniture | Big Ed's Sofas & Beds",
  description:
    "Browse every category at Big Ed's Sofas & Beds — sofas, sectionals, recliners, bedroom sets, mattresses and dining sets.",
};

export default async function ShopAllPage({ searchParams }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products: rawProducts, pagination } = await getProducts({ page, pageSize: PAGE_SIZE });
  const products = rawProducts.map(normalizeProductForCard);
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  return (
    <div className="pb-10">
      <PageHero
        title="Shop All Furniture"
        subtitle="Quality furniture for every room, at prices built for real budgets."
      />

      <Container className="mt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop All" }]} />

        <div className="mt-6">
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
          <Pagination page={page} totalPages={totalPages} basePath="/shop" />
        </div>
      </Container>
    </div>
  );
}
