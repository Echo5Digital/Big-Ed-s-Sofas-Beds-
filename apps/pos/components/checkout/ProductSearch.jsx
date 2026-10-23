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
  const [highlighted, setHighlighted] = useState(0);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const data = await api.get(`/catalog/products?pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      setResults(flattenVariants(data.products));
      setHighlighted(0);
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
        return;
      }
      // No barcode match — add whichever result is keyboard-highlighted so
      // a cashier can search then add without reaching for the mouse.
      const current = results[highlighted];
      if (current && current.totalAvailable > 0) {
        onAdd(current);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
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
          className="w-full rounded-xl border border-black/15 bg-white py-3.5 pl-10 pr-3 text-base shadow-sm transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col gap-2 px-1 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-1 py-10 text-center">
            <p className="text-sm font-medium text-brand-charcoal/60">No products found</p>
            <p className="text-xs text-brand-charcoal/40">Try a different name or scan the item&apos;s barcode.</p>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {results.map((row, index) => (
            <li key={row.variantId}>
              <button
                type="button"
                onClick={() => onAdd(row)}
                onMouseEnter={() => setHighlighted(index)}
                disabled={row.totalAvailable <= 0}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4 ${
                  index === highlighted
                    ? "border-brand-red/40 ring-2 ring-brand-red/15"
                    : "border-black/10 hover:border-black/20 hover:bg-brand-cream/40"
                }`}
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
                  <span className="rounded-full bg-brand-charcoal px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                    + Add
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
