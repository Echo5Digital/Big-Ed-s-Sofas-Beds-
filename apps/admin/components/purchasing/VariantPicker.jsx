"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

// Type-to-search replacement for a plain <select> of every variant in the
// catalog (734+ SKUs at the time this was written) — that dropdown made every
// New Purchase Order page load fetch and render the full catalog just to
// populate one field. Mirrors the exact debounce/search pattern
// LinkedProductPicker.jsx already uses against the same GET
// /catalog/admin/products?q= endpoint (search-only, take: 20 — see
// catalog.routes.js), just flattened to variants since a PO line picks one
// specific SKU, not a whole product.
export default function VariantPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState({ query: "", results: [], error: null });
  const trimmedQuery = query.trim();
  const searching = trimmedQuery !== "" && searchState.query !== trimmedQuery && !searchState.error;

  useEffect(() => {
    if (!trimmedQuery) return undefined;
    const timeout = setTimeout(() => {
      api
        .get(`/catalog/admin/products?q=${encodeURIComponent(trimmedQuery)}`)
        .then((data) => {
          const variants = data.products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name })));
          setSearchState({ query: trimmedQuery, results: variants, error: null });
        })
        .catch(() => setSearchState({ query: trimmedQuery, results: [], error: "Search failed." }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const results = searchState.query === trimmedQuery ? searchState.results : [];
  const error = searchState.query === trimmedQuery ? searchState.error : null;

  function pick(variant) {
    onChange(variant);
    setQuery("");
  }

  return (
    <div className="relative flex flex-col gap-1">
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-black/15 px-2.5 py-1.5 text-sm">
          <span className="min-w-0 truncate">
            <span className="font-mono">{value.sku}</span> — {value.productName} ({value.name})
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Change variant"
            className="shrink-0 font-medium text-brand-red hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          type="text"
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by SKU or product name…"
          className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      )}

      {!value && query.trim() && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-black/10 bg-white shadow-lg">
          {searching ? (
            <p className="px-3 py-2.5 text-sm text-brand-charcoal/60">Searching…</p>
          ) : error ? (
            <p className="px-3 py-2.5 text-sm text-red-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-brand-charcoal/60">No matching variants.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((variant) => (
                <li key={variant.id}>
                  <button
                    type="button"
                    onClick={() => pick(variant)}
                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-black/5"
                  >
                    <span className="font-mono">{variant.sku}</span> — {variant.productName} ({variant.name})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
