"use client";

import { useEffect, useState, useId } from "react";
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
  const [activeIndex, setActiveIndex] = useState(-1);
  // The latest response, tagged with the query it answers — loading/results/
  // error are all derived from comparing this to the live trimmedQuery
  // below, rather than setResults([])/setLoading(true)/etc. called directly
  // in the effect body (which React's set-state-in-effect rule flags as a
  // cascading-render risk). Clearing the box is then just "trimmedQuery is
  // empty", which the derived showResults/results already resolve to empty
  // with no separate reset needed.
  const [result, setResult] = useState({ key: "", products: [], error: false });
  const inputId = useId();
  const listId = useId();
  const router = useRouter();

  const trimmedQuery = query.trim();
  const loading = trimmedQuery !== "" && result.key !== trimmedQuery && !result.error;
  const results = result.key === trimmedQuery ? result.products : [];
  const error = result.key === trimmedQuery ? result.error : false;

  useEffect(() => {
    if (!trimmedQuery) return undefined;

    let cancelled = false;
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
          if (cancelled) return;
          setResult({ key: trimmedQuery, products: data.products.map(normalizeProductForCard), error: false });
          setActiveIndex(-1);
        })
        .catch(() => {
          if (cancelled) return;
          setResult({ key: trimmedQuery, products: [], error: true });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [trimmedQuery]);

  const showResults = focused && trimmedQuery.length > 0;
  const activeOptionId = activeIndex >= 0 && results[activeIndex] ? `${listId}-option-${activeIndex}` : undefined;

  function goToResultsPage() {
    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    setFocused(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      // With a suggestion highlighted (arrowed to), Enter still goes straight
      // to that one product's page — same as clicking it. Otherwise (the
      // common case: typed a keyword and hit Enter without touching the
      // arrow keys) it goes to the full search-results page instead of doing
      // nothing, which was this box's previous behavior.
      if (!trimmedQuery) return;
      event.preventDefault();
      if (showResults && activeIndex >= 0 && results[activeIndex]) {
        router.push(`/shop/${results[activeIndex].slug}`);
        setFocused(false);
      } else {
        goToResultsPage();
      }
      return;
    }
    if (!showResults || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
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
        <button
          type="button"
          // mousedown (not click/onClick) fires before the input's onBlur,
          // so this still works even though the blur listener above would
          // otherwise close showResults/clear focus first on a plain click.
          onMouseDown={(event) => {
            event.preventDefault();
            if (trimmedQuery) goToResultsPage();
          }}
          aria-label="Search"
          className="shrink-0 text-brand-charcoal/50 hover:text-brand-charcoal focus-visible:outline-2 focus-visible:outline-brand-red"
        >
          <Search className="size-4" aria-hidden="true" />
        </button>
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
