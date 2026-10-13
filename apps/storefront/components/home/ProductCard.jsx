"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Check, Heart } from "lucide-react";
import StarRating from "@/components/ui/StarRating";
import Price from "@/components/ui/Price";
import { useDemoCart } from "@/components/layout/DemoCartProvider";

const BADGE_STYLES = {
  "BEST SELLER": "bg-brand-charcoal text-white",
  SALE: "bg-brand-red text-white",
};

export default function ProductCard({ product }) {
  const { addToCart, wishlistIds, toggleWishlist } = useDemoCart();
  const [justAdded, setJustAdded] = useState(false);
  const isWishlisted = wishlistIds.includes(product.id);

  function handleAddToCart() {
    addToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-brand-charcoal/10 bg-white shadow-sm">
      <div className="relative aspect-4/3 shrink-0 overflow-hidden bg-brand-cream">
        <Link
          href={`/products/${product.slug}`}
          className="absolute inset-0 block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover"
          />
        </Link>
        {product.badge && (
          <span
            className={`pointer-events-none absolute left-2.5 top-2.5 rounded px-2 py-1 text-[10px] font-bold tracking-wide ${BADGE_STYLES[product.badge] ?? "bg-brand-gold text-brand-charcoal"}`}
          >
            {product.badge}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-pressed={isWishlisted}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className="absolute right-2.5 top-2.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-brand-charcoal shadow-sm hover:text-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        >
          <Heart
            className="size-4"
            aria-hidden="true"
            fill={isWishlisted ? "currentColor" : "none"}
            strokeWidth={isWishlisted ? 0 : 2}
            color={isWishlisted ? "var(--color-brand-red)" : undefined}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-brand-charcoal hover:text-brand-red-dark focus-visible:outline-none"
        >
          {product.name}
        </Link>
        <StarRating rating={product.rating} reviewCount={product.reviewCount} />
        <Price price={product.price} compareAtPrice={product.compareAtPrice} />

        <button
          type="button"
          onClick={handleAddToCart}
          className="mt-auto flex items-center justify-center gap-2 rounded-full bg-brand-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
        >
          {justAdded ? (
            <>
              <Check className="size-4 shrink-0" aria-hidden="true" />
              Added
            </>
          ) : (
            <>
              <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
