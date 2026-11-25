"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Flyer carousel: a large, fully-visible image (object-contain — these are
// whole promotional graphics with their own baked-in ribbons/pricing text,
// never cropped) paired with a big caption that changes with the active
// image. No dark card, no background box — it sits directly on the page's
// own cream background so it reads as part of the section, not a separate
// isolated widget. No prev/next arrows either: the thumbnail strip is the
// only manual control (plus a swipe on the image itself on touch devices).
//
// images: array of { src, alt, caption, subcaption, price, priceLabel }.
// caption is a big line shown next to/above the image, changing per slide —
// see SaleProducts.jsx and LivingRoomSpecials.jsx for the actual per-image
// text. price/priceLabel render as a standalone badge (e.g. priceLabel
// "Door Buster", price "$349.99") rather than being folded into the
// subcaption sentence.
//
// No carousel library exists in this app; this follows the same behavioral
// conventions as the homepage's coverflow carousel (components/home/
// DealsCarousel.jsx): setInterval autoplay paused on hover/touch, a 40px
// swipe threshold, cleared on unmount.
export default function ImageCarousel({ images, intervalMs = 5000 }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  // Lazy initializer reads the synchronous initial value directly (SSR has
  // no `window`, so it still falls back to false there) — the effect below
  // only needs to subscribe to future changes, not also seed the initial
  // read, which is what let this call setState unconditionally on mount.
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const touchStartX = useRef(null);

  const total = images.length;
  const active = images[activeIndex];

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event) => setReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  function goTo(index) {
    setActiveIndex(((index % total) + total) % total);
  }

  // Autoplay — paused on hover/touch, and never runs at all under
  // prefers-reduced-motion (manual-only in that case), same convention as
  // the marquee/ticker CSS animations elsewhere in this app.
  useEffect(() => {
    if (isHovered || reducedMotion || total <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % total);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isHovered, reducedMotion, total, intervalMs]);

  function onTouchStart(event) {
    touchStartX.current = event.touches[0].clientX;
  }

  function onTouchEnd(event) {
    if (touchStartX.current === null) return;
    const diffX = event.changedTouches[0].clientX - touchStartX.current;
    if (diffX > 40) goTo(activeIndex - 1);
    else if (diffX < -40) goTo(activeIndex + 1);
    touchStartX.current = null;
  }

  if (!images || total === 0) return null;

  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
      {/* Caption — big, on the page's own background, no card around it. An
          eyebrow label + red accent rule + price badge give the block its
          own visual anchor so it reads as composed with the image, not just
          text floating next to a picture. */}
      <div className="order-2 w-full text-center lg:order-1 lg:w-2/5 lg:text-left">
        <p className="font-display text-xs font-bold tracking-[0.2em] text-brand-red uppercase">
          Grand Opening Flyer
        </p>
        <span className="mx-auto mt-3 block h-1 w-14 rounded-full bg-brand-red lg:mx-0" aria-hidden="true" />
        <h3 className="mt-4 font-display text-3xl leading-tight font-bold text-brand-charcoal transition-opacity duration-300 sm:text-4xl lg:text-5xl">
          {active.caption}
        </h3>
        {active.subcaption ? (
          <p className="mt-3 text-base text-brand-charcoal/60 sm:text-lg">{active.subcaption}</p>
        ) : null}
        {active.price ? (
          <span className="mt-5 inline-flex items-baseline gap-2 rounded-full bg-brand-red px-5 py-2 text-white shadow-sm">
            {active.priceLabel ? (
              <span className="text-xs font-bold tracking-wide uppercase">{active.priceLabel}</span>
            ) : null}
            <span className="font-display text-xl font-bold sm:text-2xl">{active.price}</span>
          </span>
        ) : null}

        {/* Thumbnail strip — the only manual control. */}
        {total > 1 ? (
          <div className="scrollbar-hide mt-7 flex justify-center gap-2.5 overflow-x-auto px-1 lg:justify-start">
            {images.map((image, index) => (
              <button
                key={image.src}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show image ${index + 1} of ${total}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`relative aspect-square w-14 shrink-0 overflow-hidden rounded-lg bg-white transition-all duration-200 sm:w-16 ${
                  index === activeIndex
                    ? "shadow-md ring-2 ring-brand-red"
                    : "opacity-50 ring-1 ring-brand-charcoal/10 hover:opacity-90"
                }`}
              >
                <Image src={image.src} alt="" fill sizes="64px" className="object-contain p-1" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Image */}
      <div
        className="relative order-1 aspect-square w-full lg:order-2 lg:w-3/5"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {images.map((image, index) => (
          <Image
            key={image.src}
            src={image.src}
            alt={image.alt}
            fill
            priority={index === 0}
            sizes="(max-width: 1024px) 90vw, 60vw"
            className={`object-contain transition-opacity duration-700 ease-in-out ${
              index === activeIndex ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
