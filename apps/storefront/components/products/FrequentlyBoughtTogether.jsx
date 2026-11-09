"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, ShoppingCart, Check } from "lucide-react";
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
    <div className="rounded-2xl border border-brand-charcoal/10 bg-white p-5">
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap sm:items-center">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <label className="flex w-24 shrink-0 flex-col items-center gap-2 text-center sm:w-28">
              <span className="relative aspect-square w-full overflow-hidden rounded-xl bg-brand-cream">
                {item.image && (
                  <Image src={item.image} alt={stripInlineMarkdown(item.name)} fill sizes="112px" className="object-cover" />
                )}
                <input
                  type="checkbox"
                  checked={checkedIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  aria-label={`Include ${stripInlineMarkdown(item.name)} in the bundle`}
                  className="absolute left-1.5 top-1.5 size-4 rounded border-brand-charcoal/30 text-brand-red focus:ring-brand-red"
                />
              </span>
              <Link
                href={`/products/${item.slug}`}
                className="line-clamp-2 text-xs font-semibold text-brand-charcoal hover:text-brand-red-dark"
              >
                {stripInlineMarkdown(item.name)}
              </Link>
              <span className="text-xs font-bold text-brand-charcoal">{formatCurrency(item.price)}</span>
            </label>
            {index < items.length - 1 && (
              <Plus className="size-4 shrink-0 text-brand-charcoal/30" aria-hidden="true" />
            )}
          </div>
        ))}

        <div className="flex w-full flex-col gap-2 border-t border-brand-charcoal/10 pt-4 sm:ml-auto sm:w-auto sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
          <p className="text-xs text-brand-charcoal/60">
            Total for {checkedItems.length} item{checkedItems.length === 1 ? "" : "s"}
          </p>
          <p className="text-xl font-bold text-brand-charcoal">{formatCurrency(combinedTotal)}</p>
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={checkedItems.length === 0}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-charcoal/20 disabled:text-brand-charcoal/50"
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
    </div>
  );
}
