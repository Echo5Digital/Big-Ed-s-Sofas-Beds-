"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ArrowRight, Flame } from "lucide-react";
import { stripInlineMarkdown } from "@big-eds/ui";
import { formatCurrency } from "@/utils/formatCurrency";

export default function DealsCarousel({ products }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef(null);

  const total = products.length;

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  // Gentle autoplay, pausing when shopper hovers or touches the carousel
  useEffect(() => {
    if (isHovered || total <= 1) return;
    const timer = setInterval(handleNext, 4500);
    return () => clearInterval(timer);
  }, [isHovered, handleNext, total]);

  // Touch swipe support for mobile shoppers
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    if (diffX > 40) handlePrev();
    else if (diffX < -40) handleNext();
    touchStartX.current = null;
  };

  if (!products || total === 0) return null;

  return (
    <div
      className="relative w-full select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* 3D Coverflow Stage */}
      <div className="relative w-full overflow-hidden px-4 sm:px-6 py-4">
        {/* Invisible placeholder to establish the exact natural height of the stage */}
        <div
          className="invisible pointer-events-none mx-auto w-[68%] sm:w-[58%] lg:w-[62%] max-w-75"
          aria-hidden="true"
        >
          <div className="relative aspect-4/3 w-full" />
          <div className="flex flex-col p-3.5">
            <p className="text-xs sm:text-sm font-bold">Placeholder</p>
            <div className="mt-1 h-5 w-24" />
            <div className="mt-2.5 h-8 w-full" />
          </div>
        </div>

        {/* Carousel Cards */}
        {products.map((product, index) => {
          let diff = index - activeIndex;
          if (diff > total / 2) diff -= total;
          if (diff < -total / 2) diff += total;

          const isCenter = diff === 0;
          const isLeft = diff === -1;
          const isRight = diff === 1;
          const isVisible = isCenter || isLeft || isRight;

          let transform = "translate3d(-50%, -50%, 0) scale(0.5)";
          let zIndex = 0;
          let opacity = 0;
          let pointerEvents = "none";

          if (isCenter) {
            transform = "translate3d(-50%, -50%, 0) scale(1)";
            zIndex = 20;
            opacity = 1;
            pointerEvents = "auto";
          } else if (isLeft) {
            transform = "translate3d(calc(-50% - 60%), -50%, 0) scale(0.84)";
            zIndex = 10;
            opacity = 0.65;
            pointerEvents = "auto";
          } else if (isRight) {
            transform = "translate3d(calc(-50% + 60%), -50%, 0) scale(0.84)";
            zIndex = 10;
            opacity = 0.65;
            pointerEvents = "auto";
          } else if (diff === -2) {
            transform = "translate3d(calc(-50% - 110%), -50%, 0) scale(0.7)";
            zIndex = 5;
            opacity = 0;
          } else if (diff === 2) {
            transform = "translate3d(calc(-50% + 110%), -50%, 0) scale(0.7)";
            zIndex = 5;
            opacity = 0;
          }

          const plainName = stripInlineMarkdown(product.name);
          const discountPercent =
            product.compareAtPrice && product.compareAtPrice > product.price
              ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
              : null;

          const cardContent = (
            <div
              className={`group flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 ${
                isCenter
                  ? "ring-2 ring-brand-gold/80 shadow-[0_16px_36px_rgba(0,0,0,0.65)]"
                  : "shadow-lg hover:opacity-90"
              }`}
            >
              {/* Product Image */}
              <div className="relative aspect-4/3 w-full bg-brand-cream/80 overflow-hidden">
                {product.image && (
                  <Image
                    src={product.image}
                    alt={plainName}
                    fill
                    sizes="(max-width: 640px) 70vw, 320px"
                    className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                  />
                )}

                {/* Savings Badge */}
                {discountPercent && discountPercent > 0 ? (
                  <span className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-extrabold text-white shadow-md">
                    <Flame className="size-3 text-brand-gold" aria-hidden="true" />
                    <span>{discountPercent}% OFF</span>
                  </span>
                ) : (
                  <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-brand-gold px-2 py-0.5 text-[11px] font-extrabold text-brand-charcoal shadow-md">
                    DEAL
                  </span>
                )}
              </div>

              {/* Product Details */}
              <div className="flex flex-col p-3.5 text-left">
                <p
                  className="line-clamp-1 text-xs sm:text-sm font-bold text-brand-charcoal"
                  title={plainName}
                >
                  {plainName}
                </p>

                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-base sm:text-lg font-black text-brand-red">
                    {formatCurrency(product.price)}
                  </span>
                  {product.compareAtPrice && product.compareAtPrice > product.price && (
                    <span className="text-xs text-brand-charcoal/40 line-through">
                      {formatCurrency(product.compareAtPrice)}
                    </span>
                  )}
                </div>

                {/* CTA only on active center card */}
                {isCenter ? (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-brand-red py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-red-dark">
                    <span>Shop Deal</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </div>
                ) : (
                  <div className="mt-2.5 h-7 w-full flex items-center justify-center text-[11px] font-semibold text-brand-charcoal/50">
                    Click to view
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <div
              key={product.id}
              onClick={() => {
                if (isLeft) handlePrev();
                else if (isRight) handleNext();
              }}
              style={{
                transform,
                zIndex,
                opacity,
                pointerEvents,
                transition: "transform 400ms cubic-bezier(0.25, 1, 0.5, 1), opacity 400ms ease, box-shadow 400ms ease",
              }}
              className="absolute left-1/2 top-1/2 w-[68%] sm:w-[58%] lg:w-[62%] max-w-75 cursor-pointer"
            >
              {isCenter ? (
                <Link href={`/products/${product.slug}`} className="block">
                  {cardContent}
                </Link>
              ) : (
                cardContent
              )}
            </div>
          );
        })}

        {/* Previous Button `<` */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous Deal"
          className="absolute left-0 sm:left-1 top-1/2 -translate-y-1/2 z-30 flex size-9 sm:size-11 items-center justify-center rounded-full bg-transparent text-white hover:text-brand-gold hover:bg-black/20 transition-all duration-200 active:scale-90 focus-visible:outline-2 focus-visible:outline-brand-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
        >
          <ChevronLeft className="size-6 sm:size-7" strokeWidth={2.5} aria-hidden="true" />
        </button>

        {/* Next Button `>` */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next Deal"
          className="absolute right-0 sm:right-1 top-1/2 -translate-y-1/2 z-30 flex size-9 sm:size-11 items-center justify-center rounded-full bg-transparent text-white hover:text-brand-gold hover:bg-black/20 transition-all duration-200 active:scale-90 focus-visible:outline-2 focus-visible:outline-brand-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
        >
          <ChevronRight className="size-6 sm:size-7" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {/* Pagination Indicator Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-2">
        {products.slice(0, Math.min(total, 7)).map((_, i) => {
          const isActive = activeIndex % Math.min(total, 7) === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Go to deal ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? "w-6 h-2 bg-brand-gold shadow-xs"
                  : "size-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
