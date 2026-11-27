// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import { SearchX } from "lucide-react";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import ShopPageHero from "@/components/ui/ShopPageHero";
import ProductGridWithControls from "@/components/shop/ProductGridWithControls";
import { getAllProducts, getCategories } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { withDisplayRating } from "@/lib/dailyRotation";

export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  return {
    title: query ? `Search results for "${query}" | Big Ed's Sofas & Beds` : "Search | Big Ed's Sofas & Beds",
  };
}

// Reached from SearchBox (components/layout/SearchBox.jsx) when a visitor
// presses Enter or clicks the search icon without arrowing to one of the
// typeahead's own suggestions — same full-catalog-plus-sidebar-filters
// pattern as /shop (ProductGridWithControls does its own client-side price/
// material/color/sort/pagination over whatever product array it's handed),
// just pre-filtered server-side by the GET /products `q` param (name/
// description/SKU substring match — apps/api/src/routes/catalog.routes.js)
// instead of by category.
export default async function SearchPage({ searchParams }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  if (!query) {
    return (
      <div className="pb-10">
        <ShopPageHero title="Search" subtitle="Enter a keyword above to search the catalog." />
        <Container className="mt-8">
          <EmptyState
            icon={SearchX}
            title="No search term entered"
            description="Use the search box to look for a product, category, or keyword."
            actionLabel="Shop All Furniture"
            actionHref="/shop"
          />
        </Container>
      </div>
    );
  }

  const [{ products: rawProducts }, categories] = await Promise.all([
    getAllProducts({ q: query, sort: "oldest" }),
    getCategories(),
  ]);
  // No daily shuffle here (unlike /shop) — search results should read as
  // "best/most relevant match first" within whatever order the API already
  // returns, not re-randomized on top of a real query the visitor typed.
  const products = rawProducts.map(normalizeProductForCard).map(withDisplayRating);

  return (
    <div className="pb-10">
      <ShopPageHero title={`Search results for "${query}"`} subtitle={`${products.length} product${products.length === 1 ? "" : "s"} found`} />

      <Container className="mt-8">
        {products.length > 0 ? (
          <ProductGridWithControls products={products} categories={categories} />
        ) : (
          <EmptyState
            icon={SearchX}
            title={`No results for "${query}"`}
            description="Try a different keyword, or browse the full catalog instead."
            actionLabel="Shop All Furniture"
            actionHref="/shop"
          />
        )}
      </Container>
    </div>
  );
}
