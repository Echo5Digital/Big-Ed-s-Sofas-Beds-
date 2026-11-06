"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import ProductCard from "@/components/home/ProductCard";
import FilterSidebar from "@/components/shop/FilterSidebar";
import ClientPagination from "@/components/shop/ClientPagination";
import { classifyMaterial, classifyColor } from "@/lib/productAttributes";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating-desc", label: "Avg. Rating" },
];

// Matches the page size /shop/[category] used when pagination was still
// server-side (one API page = 20 products) — kept the same so the grid's
// density on screen doesn't change, even though pagination is now a client-
// side slice of the full, already-filtered product array instead of a
// server page boundary.
const PAGE_SIZE = 20;

function priceBoundsOf(products) {
  if (products.length === 0) return { min: 0, max: 0 };
  const prices = products.map((p) => p.price);
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
}

// Sorts/filters entirely client-side over `products`, which the caller
// fetches in full for the category (see getAllProducts in lib/api/catalog.js
// — every product in the category, not one server page of it). The API has
// no price/rating sort or material/color/price filter today (see
// apps/api/src/routes/catalog.routes.js), so every control here reorders/
// narrows the complete in-memory set rather than requesting a different page
// from the server. Pagination (ClientPagination below) is applied LAST, as a
// slice over the filtered result — this ordering is what makes a filter
// correctly reach every matching product in the category instead of only
// whichever page happened to be loaded when the filter was applied.
export default function ProductGridWithControls({ products, gridClassName }) {
  const bounds = useMemo(() => priceBoundsOf(products), [products]);

  const [sort, setSort] = useState("relevance");
  const [appliedPriceRange, setAppliedPriceRange] = useState(null);
  const [priceInput, setPriceInput] = useState({ min: "", max: "" });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [page, setPage] = useState(1);

  // Computed once per product set (not per filter change) since a product's
  // own material/color never changes as other filters are toggled — only
  // which products are *visible* changes.
  const taggedProducts = useMemo(
    () =>
      products.map((p) => ({
        ...p,
        materialFamily: classifyMaterial(p.material),
        colorFamily: classifyColor(p.color),
      })),
    [products]
  );

  const availableMaterials = useMemo(
    () => [...new Set(taggedProducts.map((p) => p.materialFamily).filter(Boolean))],
    [taggedProducts]
  );
  const availableColors = useMemo(
    () => [...new Set(taggedProducts.map((p) => p.colorFamily).filter(Boolean))],
    [taggedProducts]
  );

  // The full filtered/sorted result across the WHOLE category (products is
  // already the complete category set — see getAllProducts in
  // lib/api/catalog.js — not just one server page), so a color/material/
  // price filter here correctly matches against every product in the
  // category, not just whichever page the shopper happened to be on.
  const filteredProducts = useMemo(() => {
    let result = taggedProducts;

    if (appliedPriceRange) {
      result = result.filter((p) => p.price >= appliedPriceRange.min && p.price <= appliedPriceRange.max);
    }
    if (inStockOnly) {
      result = result.filter((p) => p.totalAvailable > 0);
    }
    if (selectedMaterials.length > 0) {
      result = result.filter((p) => selectedMaterials.includes(p.materialFamily));
    }
    if (selectedColors.length > 0) {
      result = result.filter((p) => selectedColors.includes(p.colorFamily));
    }

    if (sort === "relevance") return result;

    const sorted = [...result];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    else if (sort === "rating-desc") sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return sorted;
  }, [taggedProducts, sort, appliedPriceRange, inStockOnly, selectedMaterials, selectedColors]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));

  // Any change that alters which products match (filters, sort order) can
  // easily leave `page` pointing past the new result's end — e.g. filtering
  // narrows 120 matches (6 pages) down to 8 (1 page) while the shopper was
  // sitting on page 4. Resetting to page 1 belongs here, during render (the
  // React-recommended "adjust state while rendering" pattern — see
  // https://react.dev/learn/you-might-not-need-an-effect), not in a
  // useEffect after the fact: an effect would still paint page 4's now-empty
  // slice for one frame before correcting itself. `lastFilteredProducts`
  // (plain useState, not a ref — this lint config's react-hooks/refs rule
  // forbids reading/writing ref.current during render) remembers which
  // filtered array identity `page` was last reset for, so this only fires
  // once per actual change, not on every render.
  const [lastFilteredProducts, setLastFilteredProducts] = useState(filteredProducts);
  if (lastFilteredProducts !== filteredProducts) {
    setLastFilteredProducts(filteredProducts);
    if (page !== 1) setPage(1);
  }

  const visibleProducts = useMemo(
    () => filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredProducts, page]
  );

  function handleApplyPrice() {
    const min = priceInput.min === "" ? bounds.min : Number(priceInput.min);
    const max = priceInput.max === "" ? bounds.max : Number(priceInput.max);
    if (Number.isNaN(min) || Number.isNaN(max)) return;
    setAppliedPriceRange({ min: Math.min(min, max), max: Math.max(min, max) });
  }

  function handleResetPrice() {
    setPriceInput({ min: "", max: "" });
    setAppliedPriceRange(null);
  }

  function toggleMaterial(key) {
    setSelectedMaterials((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleColor(key) {
    setSelectedColors((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function resetAll() {
    handleResetPrice();
    setInStockOnly(false);
    setSelectedMaterials([]);
    setSelectedColors([]);
  }

  const activeFilterCount =
    (appliedPriceRange ? 1 : 0) + (inStockOnly ? 1 : 0) + selectedMaterials.length + selectedColors.length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      <FilterSidebar
        priceInput={priceInput}
        onPriceInputChange={setPriceInput}
        onApplyPrice={handleApplyPrice}
        onResetPrice={handleResetPrice}
        priceBounds={bounds}
        inStockOnly={inStockOnly}
        onInStockChange={setInStockOnly}
        availableMaterials={availableMaterials}
        selectedMaterials={selectedMaterials}
        onToggleMaterial={toggleMaterial}
        availableColors={availableColors}
        selectedColors={selectedColors}
        onToggleColor={toggleColor}
        activeFilterCount={activeFilterCount}
        onResetAll={resetAll}
      />

      <div>
        <div className="flex flex-wrap items-center gap-3 border-y border-brand-charcoal/10 py-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-charcoal/70">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"}
          </span>

          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-brand-charcoal/60">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-brand-charcoal/15 bg-white px-2.5 py-1.5 text-sm font-medium text-brand-charcoal focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visibleProducts.length > 0 ? (
          <>
            <div className={gridClassName ?? "mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3"}>
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <ClientPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <p className="mt-10 text-center text-sm text-brand-charcoal/60">
            No products match these filters. Try clearing a filter.
          </p>
        )}
      </div>
    </div>
  );
}
