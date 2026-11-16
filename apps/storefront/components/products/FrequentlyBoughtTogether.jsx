"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Check } from "lucide-react";
import { stripInlineMarkdown } from "@big-eds/ui";
import { useDemoCart } from "@/components/layout/DemoCartProvider";
import { formatCurrency } from "@/utils/formatCurrency";

// Classic "bundle" FBT widget: the current product plus 1-2 picks from
// OTHER, complementary categories (see lib/categoryPairings.js — this is
// deliberately NOT the same-category "You May Also Like" section elsewhere
// on this page), each with its own checkbox (all checked by default), a
// combined running total, and one button that adds every checked item to the
// cart in one action. `items` is an array of already-normalized product-card
// shapes (normalizeProductForCard) — the first entry is always the current
// product itself, so the widget visually anchors on "this + these".
//
// Laid out as a plain responsive grid of item tiles (2-up on phones, up to
// 4-up on desktop) rather than a single flex row of "item + item + item"
// with inline "+" separators — those separators only read correctly in one
// unbroken row, and wrapped onto multiple rows (the common case on mobile,
// where up to 4 tiles don't fit on one line) they ended up sitting between
// the wrong pairs of tiles with no visual relationship to what they were
// "adding". The bundle framing instead comes from the shared card border and
// the summary bar directly underneath, not a per-item connector symbol.
export default function FrequentlyBoughtTogether({ items }) {
  const { addToCart, cartItems } = useDemoCart();
  const [checkedIds, setCheckedIds] = useState(() => new Set(items.map((item) => item.id)));
  const [justAdded, setJustAdded] = useState(false);

  function toggleItem(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const checkedItems = items.filter((item) => checkedIds.has(item.id));
  const combinedTotal = checkedItems.reduce((sum, item) => sum + item.price, 0);

  function handleAddSelected() {
    for (const item of checkedItems) {
      if (item.variantId) addToCart(item, 1);
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-charcoal/10 bg-white shadow-sm">
      <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-6 md:grid-cols-4">
        {items.map((item) => {
          const checked = checkedIds.has(item.id);
          return (
            <label
              key={item.id}
              className={`group flex cursor-pointer flex-col gap-2.5 rounded-xl border p-2.5 transition-all sm:p-3 ${
                checked
                  ? "border-brand-red/30 bg-brand-red/5"
                  : "border-brand-charcoal/10 hover:border-brand-charcoal/25 hover:bg-brand-charcoal/2"
              }`}
            >
              <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-brand-cream">
                {item.image && (
                  <Image
                    src={item.image}
                    alt={stripInlineMarkdown(item.name)}
                    fill
                    sizes="(max-width: 640px) 45vw, 180px"
                    className="object-cover"
                  />
                )}
                <span
                  className={`absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border-2 shadow-sm transition-colors sm:size-5.5 ${
                    checked
                      ? "border-brand-red bg-brand-red text-white"
                      : "border-white bg-white/90 text-transparent"
                  }`}
                >
                  <Check className="size-3 sm:size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleItem(item.id)}
                  aria-label={`Include ${stripInlineMarkdown(item.name)} in the bundle`}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <Link
                  href={`/shop/${item.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="line-clamp-2 text-xs font-semibold leading-snug text-brand-charcoal hover:text-brand-red-dark sm:text-sm"
                >
                  {stripInlineMarkdown(item.name)}
                </Link>
                <span className="text-xs font-bold text-brand-charcoal sm:text-sm">{formatCurrency(item.price)}</span>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-brand-charcoal/10 bg-brand-cream/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs text-brand-charcoal/60">
            Total for {checkedItems.length} item{checkedItems.length === 1 ? "" : "s"}
          </p>
          <p className="text-2xl font-bold text-brand-charcoal">{formatCurrency(combinedTotal)}</p>
        </div>
        <button
          type="button"
          onClick={handleAddSelected}
          disabled={checkedItems.length === 0}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-red px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-charcoal/20 disabled:text-brand-charcoal/50 disabled:shadow-none sm:py-2.5"
        >
          {justAdded ? (
            <>
              <Check className="size-4 shrink-0" aria-hidden="true" />
              Added
            </>
          ) : (
            <>
              <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
              Add Selected to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
