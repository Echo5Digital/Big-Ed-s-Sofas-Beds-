"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

// 3D coverflow carousel for the grand-opening flyers: a large center image
// flanked by smaller, faded side images receding left/right, same mechanic
// as this site's own DealsCarousel.jsx (components/home/DealsCarousel.jsx)
// adapted for plain flyer images instead of product cards (no price/CTA,
// no white card behind the image, no counter/dots — just the artwork,
// which already has its own border/ribbon baked in). Pure CSS
// transform/opacity transitions on absolutely-positioned images — no 3D
// rotateY flip — so there is no failure mode where two images can ever
// appear stacked or mid-rotation at once.
//
// images: flat array (see DoorbusterDeals.jsx) — every image gets its own
// slide, none skipped or paired.
export default function DoorbusterBook({ images }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef(null);

  const total = images.length;

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const handleChange = (event) => setReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isHovered || reducedMotion || total <= 1) return undefined;
    const timer = setInterval(handleNext, 4000);
    return () => clearInterval(timer);
  }, [isHovered, reducedMotion, handleNext, total]);

  function onTouchStart(event) {
    touchStartX.current = event.touches[0].clientX;
  }

  function onTouchEnd(event) {
    if (touchStartX.current === null) return;
    const diffX = event.changedTouches[0].clientX - touchStartX.current;
    if (diffX > 40) handlePrev();
    else if (diffX < -40) handleNext();
    touchStartX.current = null;
  }

  if (!total) return null;

  return (
    <div
      className="relative w-full select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative w-full overflow-hidden px-12 py-6 sm:px-20 sm:py-10" style={{ perspective: "1600px" }}>
        {/* Invisible placeholder establishing the stage's natural height. */}
        <div className="pointer-events-none invisible mx-auto aspect-4/3 w-[80%] max-w-xl sm:aspect-16/10 sm:w-[58%] lg:w-[46%]" aria-hidden="true" />

        {images.map((image, index) => {
          let diff = index - activeIndex;
          if (diff > total / 2) diff -= total;
          if (diff < -total / 2) diff += total;

          const isCenter = diff === 0;
          const isLeft = diff === -1;
          const isRight = diff === 1;
          const isFarLeft = diff === -2;
          const isFarRight = diff === 2;

          let transform = "translate3d(-50%, -50%, 0) scale(0.55)";
          let zIndex = 0;
          let opacity = 0;
          let pointerEvents = "none";

          if (isCenter) {
            transform = "translate3d(-50%, -50%, 0) scale(1)";
            zIndex = 30;
            opacity = 1;
            pointerEvents = "auto";
          } else if (isLeft) {
            transform = "translate3d(calc(-50% - 78%), -50%, 0) rotateY(12deg) scale(0.8)";
            zIndex = 20;
            opacity = 0.7;
            pointerEvents = "auto";
          } else if (isRight) {
            transform = "translate3d(calc(-50% + 78%), -50%, 0) rotateY(-12deg) scale(0.8)";
            zIndex = 20;
            opacity = 0.7;
            pointerEvents = "auto";
          } else if (isFarLeft) {
            transform = "translate3d(calc(-50% - 148%), -50%, 0) rotateY(16deg) scale(0.62)";
            zIndex = 10;
            opacity = 0.35;
          } else if (isFarRight) {
            transform = "translate3d(calc(-50% + 148%), -50%, 0) rotateY(-16deg) scale(0.62)";
            zIndex = 10;
            opacity = 0.35;
          }

          return (
            <div
              key={image.src}
              onClick={() => {
                if (isLeft) handlePrev();
                else if (isRight) handleNext();
              }}
              style={{
                transform,
                zIndex,
                opacity,
                pointerEvents,
                transition: "transform 450ms cubic-bezier(0.25, 1, 0.5, 1), opacity 450ms ease",
              }}
              className={`absolute top-1/2 left-1/2 aspect-4/3 w-[80%] max-w-xl sm:aspect-16/10 sm:w-[58%] lg:w-[46%] ${
                isLeft || isRight ? "cursor-pointer" : ""
              }`}
            >
              <div
                className={`relative h-full w-full transition-[filter] duration-300 ${
                  isCenter ? "drop-shadow-[0_20px_40px_rgba(20,30,70,0.35)]" : ""
                }`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 640px) 85vw, 600px"
                  className="object-contain"
                />
              </div>
            </div>
          );
        })}

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous flyer"
              className="absolute top-1/2 left-0 z-40 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand-charcoal/20 bg-white text-brand-charcoal shadow-md transition-all duration-200 hover:border-brand-red hover:text-brand-red active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red sm:size-11"
            >
              <ChevronLeft className="size-5 sm:size-6" strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next flyer"
              className="absolute top-1/2 right-0 z-40 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand-charcoal/20 bg-white text-brand-charcoal shadow-md transition-all duration-200 hover:border-brand-red hover:text-brand-red active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red sm:size-11"
            >
              <ChevronRight className="size-5 sm:size-6" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
