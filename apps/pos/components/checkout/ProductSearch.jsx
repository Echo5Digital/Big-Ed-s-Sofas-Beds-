"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatCents } from "@/lib/format";
import ProductThumbnail from "../ui/ProductThumbnail";

const PAGE_SIZE = 40;

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
        compareAtCents: variant.compareAtCents,
        taxRatePercent: variant.taxRatePercent,
        imageUrl: product.imageUrl,
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [error, setError] = useState(false);
  const [notFoundSku, setNotFoundSku] = useState(null);
  const requestIdRef = useRef(0);

  const search = useCallback(async (q) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const data = await api.get(
        `/catalog/products?fields=minimal&page=1&pageSize=${PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ""}`
      );
      if (requestId !== requestIdRef.current) return;
      setResults(flattenVariants(data.products));
      setTotal(data.pagination.total);
      setPage(1);
      setHighlighted(0);
      setError(false);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
      setTotal(0);
      setError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    const nextPage = page + 1;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const data = await api.get(
        `/catalog/products?fields=minimal&page=${nextPage}&pageSize=${PAGE_SIZE}${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );
      if (requestId !== requestIdRef.current) return;
      setResults((prev) => [...prev, ...flattenVariants(data.products)]);
      setTotal(data.pagination.total);
      setPage(nextPage);
    } catch {
      // Keep the already-loaded results; the cashier can retry by scrolling again.
    } finally {
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [loading, loadingMore, page, query]);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 250);
    return () => clearTimeout(timeout);
  }, [query, search]);

  function handleScroll(e) {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom && results.length < total) loadMore();
  }

  // Barcode scanners type the SKU then send Enter, almost always faster than
  // the 250ms debounce — so `results` at keydown time is often still from
  // before the scan, or a partial mid-scan substring, not the scanned SKU
  // itself. Falling back to "add whichever row is highlighted" in that case
  // is how a failed/unrecognized scan used to silently ring up the wrong
  // item. Now: an exact SKU match in the already-loaded results still adds
  // instantly; otherwise we run one direct lookup for that exact text before
  // giving up, and only ever fall back to the highlighted row when the
  // query box is empty (a cashier arrowing through typed-search results,
  // not a barcode scan) — never as a guess for unrecognized scanned text.
  async function handleKeyDown(e) {
    if (e.key === "Enter") {
      const trimmed = query.trim();
      if (!trimmed) return;

      const exact = results.find((r) => r.sku.toLowerCase() === trimmed.toLowerCase());
      if (exact) {
        onAdd(exact);
        setQuery("");
        setResults([]);
        setNotFoundSku(null);
        return;
      }

      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const data = await api.get(`/catalog/products?fields=minimal&page=1&pageSize=5&q=${encodeURIComponent(trimmed)}`);
        if (requestId !== requestIdRef.current) return;
        const rows = flattenVariants(data.products);
        const directExact = rows.find((r) => r.sku.toLowerCase() === trimmed.toLowerCase());
        if (directExact) {
          onAdd(directExact);
          setQuery("");
          setResults([]);
          setTotal(0);
          setNotFoundSku(null);
        } else {
          // No exact SKU anywhere — show what's known and let the cashier
          // decide, rather than silently adding an unrelated highlighted row.
          setResults(rows);
          setTotal(data.pagination.total);
          setHighlighted(0);
          setNotFoundSku(trimmed);
        }
        setError(false);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setError(true);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
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
          onChange={(e) => {
            setQuery(e.target.value);
            setNotFoundSku(null);
          }}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full rounded-xl border border-black/15 bg-white py-3.5 pl-10 pr-3 text-base shadow-sm transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
      </div>

      {notFoundSku && (
        <p role="alert" className="px-1 text-xs font-medium text-amber-700">
          No exact match for &ldquo;{notFoundSku}&rdquo; — showing closest results below.
        </p>
      )}

      {!loading && !error && results.length > 0 && (
        <p className="px-1 text-xs font-medium text-brand-charcoal/45">
          Showing {results.length} of {total} {total === 1 ? "product" : "products"}
        </p>
      )}

      <div onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col gap-2 px-1 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-1 px-1 py-10 text-center">
            <p className="text-sm font-medium text-red-600">Search failed</p>
            <p className="text-xs text-brand-charcoal/50">Check your connection and try again.</p>
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-1 py-10 text-center">
            <p className="text-sm font-medium text-brand-charcoal/60">No products found</p>
            <p className="text-xs text-brand-charcoal/40">Try a different name or scan the item&apos;s barcode.</p>
          </div>
        )}

        <ul className="flex flex-col gap-2 pb-1">
          {results.map((row, index) => (
            <li key={row.variantId}>
              <button
                type="button"
                onClick={() => onAdd(row)}
                onMouseEnter={() => setHighlighted(index)}
                disabled={row.totalAvailable <= 0}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:p-3.5 ${
                  index === highlighted
                    ? "border-brand-red/40 ring-2 ring-brand-red/15"
                    : "border-black/10 hover:border-black/20 hover:bg-brand-cream/40"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ProductThumbnail src={row.imageUrl} alt={row.productName} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-charcoal">
                      {row.productName === row.variantName ? row.productName : `${row.productName} — ${row.variantName}`}
                    </p>
                    <p className="truncate text-xs text-brand-charcoal/50">
                      SKU {row.sku} ·{" "}
                      {row.locations.length > 0
                        ? row.locations.map((l) => `${l.locationName}: ${l.availableToSell}`).join(" · ")
                        : "Out of stock"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-brand-red">{formatCents(row.priceCents)}</span>
                    {row.compareAtCents && (
                      <span className="text-xs text-brand-charcoal/40 line-through">
                        {formatCents(row.compareAtCents)}
                      </span>
                    )}
                  </span>
                  <span className="rounded-full bg-brand-charcoal px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                    + Add
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {loadingMore && (
          <div className="flex flex-col gap-2 px-1 py-2">
            <div className="h-16 animate-pulse rounded-xl bg-black/5" />
          </div>
        )}

        {!loading && !loadingMore && results.length > 0 && results.length >= total && (
          <p className="px-1 py-3 text-center text-xs text-brand-charcoal/35">End of results</p>
        )}
      </div>
    </div>
  );
}
