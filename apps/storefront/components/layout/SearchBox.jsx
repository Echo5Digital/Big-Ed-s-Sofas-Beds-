"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { formatCurrency } from "@/utils/formatCurrency";

const SEARCH_DEBOUNCE_MS = 250;

export default function SearchBox({ className = "" }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestIdRef = useRef(0);
  const inputId = useId();
  const listId = useId();
  const router = useRouter();

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      // Clearing the box must drop any stale results immediately — otherwise
      // the old list briefly reappears the instant the user starts typing a
      // new query, before the new debounced fetch has resolved.
      requestIdRef.current += 1;
      setResults([]);
      setError(false);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timeout = setTimeout(() => {
      // No explicit sort -> the catalog route's own default (newest-first).
      // A live type-ahead dropdown only shows a handful of results; the
      // previous "oldest" sort surfaced the five longest-in-the-catalog
      // matches instead of anything resembling relevance. Newest-first is
      // the closer approximation available without real text-relevance
      // ranking.
      getProducts({ q: trimmedQuery, pageSize: 5 })
        .then((data) => {
          // Ignore this response if a newer request has since superseded it —
          // without this check, a slow response to an earlier keystroke can
          // land after a faster response to a later one and overwrite it
          // with stale, mismatched results.
          if (requestId !== requestIdRef.current) return;
          setResults(data.products.map(normalizeProductForCard));
          setError(false);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setError(true);
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const showResults = focused && trimmedQuery.length > 0;
  const activeOptionId = activeIndex >= 0 && results[activeIndex] ? `${listId}-option-${activeIndex}` : undefined;

  function handleKeyDown(event) {
    if (!showResults || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const product = results[activeIndex];
      if (product) router.push(`/shop/${product.slug}`);
    } else if (event.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        Search furniture, mattresses and more
      </label>
      <div className="flex items-center gap-2 rounded-full border border-brand-charcoal/15 bg-white px-4 py-2">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder="Search furniture, mattresses and more..."
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none"
        />
        <Search className="size-4 shrink-0 text-brand-charcoal/50" aria-hidden="true" />
      </div>

      {showResults && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 left-0 z-40 mt-2 overflow-hidden rounded-xl border border-brand-charcoal/10 bg-white shadow-lg"
        >
          {loading && results.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-brand-charcoal/50">Searching…</li>
          ) : error ? (
            <li className="px-4 py-2.5 text-sm text-red-600">Search failed. Please try again.</li>
          ) : results.length > 0 ? (
            results.map((product, index) => (
              <li key={product.id} id={`${listId}-option-${index}`} role="option" aria-selected={index === activeIndex}>
                <Link
                  href={`/shop/${product.slug}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-brand-charcoal hover:bg-brand-cream ${
                    index === activeIndex ? "bg-brand-cream" : ""
                  }`}
                >
                  <span className="truncate">{product.name}</span>
                  <span className="shrink-0 font-semibold">{formatCurrency(product.price)}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-4 py-2.5 text-sm text-brand-charcoal/60">
              No products found for &ldquo;{query}&rdquo;.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
