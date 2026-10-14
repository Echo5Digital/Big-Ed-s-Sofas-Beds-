"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatCents } from "@/lib/format";

// Flattens product+variant search results into cart-addable rows, each
// carrying its own per-location stock so the cashier can see showroom vs.
// warehouse availability before adding to the cart (mirrors the kickoff
// plan's cashier POS mock on page 8).
function flattenVariants(products) {
  const rows = [];
  for (const product of products) {
    for (const variant of product.variants) {
      if (!variant.isActive) continue;
      rows.push({
        variantId: variant.id,
        sku: variant.sku,
        productName: product.name,
        variantName: variant.name,
        priceCents: variant.priceCents,
        locations: variant.availability.byLocation.filter((l) => l.availableToSell > 0),
        totalAvailable: variant.availability.totalAvailable,
      });
    }
  }
  return rows;
}

export default function ProductSearch({ onAdd }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const data = await api.get(`/catalog/products?pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      setResults(flattenVariants(data.products));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 250);
    return () => clearTimeout(timeout);
  }, [query, search]);

  function handleKeyDown(e) {
    // Barcode scanners type the SKU then send Enter — jump straight to an
    // exact SKU match instead of waiting on the debounce.
    if (e.key === "Enter") {
      const exact = results.find((r) => r.sku.toLowerCase() === query.trim().toLowerCase());
      if (exact) {
        onAdd(exact);
        setQuery("");
        setResults([]);
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal/40" aria-hidden="true" />
        <input
          type="text"
          placeholder="Scan barcode or search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full rounded-xl border border-black/15 bg-white py-3.5 pl-10 pr-3 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="px-1 py-4 text-sm text-brand-charcoal/50">Searching…</p>}

        {!loading && results.length === 0 && (
          <p className="px-1 py-4 text-sm text-brand-charcoal/50">No products found.</p>
        )}

        <ul className="flex flex-col gap-2">
          {results.map((row) => (
            <li key={row.variantId}>
              <button
                type="button"
                onClick={() => onAdd(row)}
                disabled={row.totalAvailable <= 0}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3.5 text-left shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-charcoal">
                    {row.productName} — {row.variantName}
                  </p>
                  <p className="truncate text-xs text-brand-charcoal/50">
                    SKU {row.sku} ·{" "}
                    {row.locations.length > 0
                      ? row.locations.map((l) => `${l.locationName}: ${l.availableToSell}`).join(" · ")
                      : "Out of stock"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold text-brand-red">{formatCents(row.priceCents)}</span>
                  <span className="rounded-full bg-brand-charcoal px-3 py-1.5 text-xs font-semibold text-white">+ Add</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
