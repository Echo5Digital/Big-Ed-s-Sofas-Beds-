"use client";

import { useMemo, useState, useId } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { products } from "@/lib/mock-data/products";
import { formatCurrency } from "@/utils/formatCurrency";

export default function SearchBox({ className = "" }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputId = useId();
  const listId = useId();

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((product) => product.name.toLowerCase().includes(term))
      .slice(0, 5);
  }, [query]);

  const showResults = focused && query.trim().length > 0;

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
          placeholder="Search furniture, mattresses and more..."
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none"
        />
        <Search className="size-4 shrink-0 text-brand-charcoal/50" aria-hidden="true" />
      </div>

      {showResults && (
        <ul
          id={listId}
          className="absolute right-0 left-0 z-40 mt-2 overflow-hidden rounded-xl border border-brand-charcoal/10 bg-white shadow-lg"
        >
          {results.length > 0 ? (
            results.map((product) => (
              <li key={product.id}>
                <Link
                  href="#"
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-brand-charcoal hover:bg-brand-cream"
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
