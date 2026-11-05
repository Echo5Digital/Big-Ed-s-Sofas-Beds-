"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api/client";

// Cross-links to OTHER, independently-sellable products (see ProductLink in
// packages/database/prisma/schema.prisma) — NOT this product's own color/size
// variant (the single SKU/price fields in the Basics card above). Linking is
// always symmetric: adding a product here also makes THIS product appear
// under the other one automatically, and removing it here removes it from
// both sides too — enforced server-side in catalog.routes.js, not here.
//
// `excludeProductId` (the product currently being edited, undefined on the
// New Product form) keeps a product from appearing as a candidate to link to
// itself — the API would ignore/reject it anyway, but filtering it from the
// search results is clearer than letting staff pick it and nothing happen.
export default function LinkedProductPicker({ linkedProducts, onChange, excludeProductId }) {
  const [query, setQuery] = useState("");
  // Keyed by the exact query string the results/error belong to, so render
  // can tell "nothing fetched yet for this query" apart from "fetched and
  // got zero results" without a separate effect just to reset state when the
  // query is cleared — the dropdown below already hides itself whenever
  // query is blank, so nothing needs to actively clear results/error.
  const [searchState, setSearchState] = useState({ query: "", results: [], error: null });
  const trimmedQuery = query.trim();
  const searching = trimmedQuery !== "" && searchState.query !== trimmedQuery && !searchState.error;

  useEffect(() => {
    if (!trimmedQuery) return undefined;
    // Debounced so every keystroke doesn't fire its own request — matches the
    // delay other search-as-you-type inputs in this app use.
    const timeout = setTimeout(() => {
      api
        .get(`/catalog/admin/products?q=${encodeURIComponent(trimmedQuery)}`)
        .then((data) => setSearchState({ query: trimmedQuery, results: data.products, error: null }))
        .catch(() => setSearchState({ query: trimmedQuery, results: [], error: "Search failed." }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const results = searchState.query === trimmedQuery ? searchState.results : [];
  const error = searchState.query === trimmedQuery ? searchState.error : null;

  const linkedIds = new Set(linkedProducts.map((p) => p.id));
  const candidates = results.filter((p) => p.id !== excludeProductId && !linkedIds.has(p.id));

  function add(product) {
    onChange([...linkedProducts, product]);
    setQuery("");
  }

  function removeAt(index) {
    onChange(linkedProducts.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product name or SKU…"
          className="w-full rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red sm:py-2"
        />

        {query.trim() && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/10 bg-white shadow-lg">
            {searching ? (
              <p className="px-3 py-2.5 text-sm text-brand-charcoal/60">Searching…</p>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-brand-charcoal/60">No matching products.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto py-1">
                {candidates.map((product) => {
                  const variant = product.variants.find((v) => v.isActive) ?? product.variants[0];
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => add(product)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-black/5"
                      >
                        <span className="relative size-9 shrink-0 overflow-hidden rounded bg-black/5">
                          {product.images[0] && (
                            <Image
                              src={product.images[0].url}
                              alt=""
                              fill
                              sizes="36px"
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-brand-charcoal">{product.name}</span>
                          {variant && (
                            <span className="block truncate font-mono text-xs text-brand-charcoal/50">
                              {variant.sku}
                            </span>
                          )}
                        </span>
                        <Plus className="size-4 shrink-0 text-brand-charcoal/40" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {linkedProducts.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {linkedProducts.map((product, index) => {
            const variant = product.variants?.find((v) => v.isActive) ?? product.variants?.[0];
            return (
              <li
                key={product.id}
                className="flex items-center gap-2.5 rounded-lg border border-black/10 p-2"
              >
                <span className="relative size-10 shrink-0 overflow-hidden rounded bg-black/5">
                  {product.images?.[0] && (
                    <Image
                      src={product.images[0].url}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-brand-charcoal">{product.name}</span>
                  {variant && (
                    <span className="block truncate font-mono text-xs text-brand-charcoal/50">{variant.sku}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={`Remove ${product.name} from linked products`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand-charcoal/50 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
