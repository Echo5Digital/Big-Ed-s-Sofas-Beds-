"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Check, Heart } from "lucide-react";
import { stripInlineMarkdown } from "@big-eds/ui";
import StarRating from "@/components/ui/StarRating";
import Price from "@/components/ui/Price";
import InlineMarkdown from "@/components/ui/InlineMarkdown";
import { useDemoCart } from "@/components/layout/DemoCartProvider";

const BADGE_STYLES = {
  "BEST SELLER": "bg-brand-charcoal text-white",
  SALE: "bg-brand-red text-white",
  "OUT OF STOCK": "bg-brand-charcoal/60 text-white",
};

export default function ProductCard({ product, showRatingValue = false }) {
  const { addToCart, cartItems, wishlistIds, toggleWishlist } = useDemoCart();
  const [justAdded, setJustAdded] = useState(false);
  const isWishlisted = wishlistIds.includes(product.id);
  const isInCart = cartItems.some((item) => item.variantId === product.variantId);
  const plainName = stripInlineMarkdown(product.name);

  function handleAddToCart() {
    addToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-brand-charcoal/10 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* object-cover fills the frame edge-to-edge (per explicit product
          request) — on wide landscape room-scene shots (e.g. a full
          sectional spanning the source photo) or tall portrait shots (a
          single nightstand), this does crop into the image rather than
          letterbox it; that tradeoff was chosen deliberately over the
          previous object-contain treatment. */}
      <div className="relative aspect-square shrink-0 overflow-hidden bg-brand-cream">
        <Link
          href={`/products/${product.slug}`}
          className="absolute inset-0 block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        >
          {product.image && (
            <Image
              src={product.image}
              alt={plainName}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </Link>
        {product.badge && (
          <span
            className={`pointer-events-none absolute left-2 top-2 max-w-[calc(100%-3.25rem)] truncate rounded px-1.5 py-1 text-[9px] font-bold tracking-wide sm:left-2.5 sm:top-2.5 sm:max-w-[calc(100%-3.5rem)] sm:px-2 sm:text-[10px] ${BADGE_STYLES[product.badge] ?? "bg-brand-gold text-brand-charcoal"}`}
          >
            {product.badge}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-pressed={isWishlisted}
          aria-label={isWishlisted ? `Remove ${plainName} from wishlist` : `Add ${plainName} to wishlist`}
          className="absolute right-2 top-2 flex size-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-brand-charcoal shadow-sm hover:text-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red sm:right-2.5 sm:top-2.5 sm:size-10"
        >
          <Heart
            className="size-4 sm:size-4.5"
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
          <InlineMarkdown text={product.name} />
        </Link>
        {typeof product.rating === "number" && (
          <StarRating rating={product.rating} reviewCount={product.reviewCount} showValue={showRatingValue} />
        )}
        <Price price={product.price} compareAtPrice={product.compareAtPrice} size="sm" showDiscount />

        {isInCart && !justAdded ? (
          <Link
            href="/cart"
            className="mt-auto flex items-center justify-center gap-2 rounded-full bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
          >
            <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
            Go to Cart
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={product.totalAvailable === 0}
            className="mt-auto flex items-center justify-center gap-2 rounded-full bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-charcoal/20 disabled:text-brand-charcoal/50"
          >
            {justAdded ? (
              <>
                <Check className="size-4 shrink-0" aria-hidden="true" />
                Added
              </>
            ) : (
              <>
                <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
                {product.totalAvailable === 0 ? "Out of Stock" : "Add to Cart"}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
