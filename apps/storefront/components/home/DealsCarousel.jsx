"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { stripInlineMarkdown } from "@big-eds/ui";
import Price from "@/components/ui/Price";

// Compact carousel sized to sit in the deals section's right-hand column
// (not a full-width row) — a smaller, denser card than the shared
// ProductCard (no Add to Cart button, no wishlist heart, no star rating),
// since the regular card's footprint is too tall/wide for this narrow space.
// Horizontal scroll-snap, not a JS-animated transform: the middle card sits
// fully visible while the next/previous cards peek in at the edges via
// scroll padding, and native touch/trackpad swipe works for free. Arrow
// buttons scroll by exactly one card's width + gap so they always land on
// the next snap point regardless of column width.
function DealCard({ product }) {
  const plainName = stripInlineMarkdown(product.name);
  return (
    <Link
      href={`/products/${product.slug}`}
      data-carousel-card
      className="block w-[70%] shrink-0 snap-center overflow-hidden rounded-xl bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
    >
      <div className="relative aspect-square w-full bg-brand-cream">
        {product.image && (
          <Image
            src={product.image}
            alt={plainName}
            fill
            sizes="(max-width: 640px) 60vw, 220px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        <p className="line-clamp-1 text-xs font-semibold text-brand-charcoal">{plainName}</p>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} size="sm" showDiscount />
      </div>
    </Link>
  );
}

export default function DealsCarousel({ products }) {
  const trackRef = useRef(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateArrowState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollPrev(track.scrollLeft > 4);
    setCanScrollNext(track.scrollLeft < track.scrollWidth - track.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrowState();
    const track = trackRef.current;
    if (!track) return;
    // Re-check on resize too — how much of the next/previous card peeks in
    // (and therefore whether there's anything left to scroll to) depends on
    // the column's width, not just scroll position.
    const resizeObserver = new ResizeObserver(updateArrowState);
    resizeObserver.observe(track);
    return () => resizeObserver.disconnect();
  }, [updateArrowState]);

  function scrollByOneCard(direction) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("[data-carousel-card]");
    const cardWidth = card ? card.getBoundingClientRect().width : track.clientWidth;
    const gap = 12;
    track.scrollBy({ left: direction * (cardWidth + gap), behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <div className="relative w-full">
      <div
        ref={trackRef}
        onScroll={updateArrowState}
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-7 py-1"
      >
        {products.map((product) => (
          <DealCard key={product.id} product={product} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByOneCard(-1)}
        disabled={!canScrollPrev}
        aria-label="Previous deal"
        className="absolute left-0 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-charcoal shadow-lg transition-opacity hover:bg-brand-cream disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => scrollByOneCard(1)}
        disabled={!canScrollNext}
        aria-label="Next deal"
        className="absolute right-0 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-charcoal shadow-lg transition-opacity hover:bg-brand-cream disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
