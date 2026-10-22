"use client";

import { useRef, useState } from "react";
import Image from "next/image";

// How far "into" the image the magnifier lens looks, relative to the lens
// size — e.g. 2.5 means the lens shows a region 2.5x smaller than the lens
// itself, so the zoomed view appears at 2.5x magnification.
const ZOOM_LEVEL = 2.5;

// Hero image + thumbnail strip for the purchase column. The full image list
// (same ProductImage rows, see apps/api/src/routes/catalog.routes.js) is
// reused again further down the page as the large-format gallery section —
// there's no separate "gallery" image set, just a different layout of the
// same ordered list.
export default function ProductImageGallery({ images, name, inStock }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(null);
  const frameRef = useRef(null);
  const active = images[activeIndex] ?? images[0];

  function handleMouseMove(e) {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        onMouseEnter={handleMouseMove}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoom(null)}
        className="group relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-brand-cream shadow-sm"
      >
        {active && (
          <>
            <Image
              src={active.url}
              alt={active.altText || name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            {/* Magnifier lens: a second copy of the same image, scaled up and
                positioned so the point under the cursor stays under the
                cursor, revealed only inside a circular lens that follows the
                mouse. Hidden on touch devices (no hover) via lg:group-hover. */}
            {zoom && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-150 group-hover:opacity-100 lg:block"
                style={{
                  backgroundImage: `url(${active.url})`,
                  backgroundSize: `${ZOOM_LEVEL * 100}%`,
                  backgroundPosition: `${zoom.x}% ${zoom.y}%`,
                  backgroundRepeat: "no-repeat",
                  clipPath: `circle(90px at ${zoom.x}% ${zoom.y}%)`,
                }}
              />
            )}
          </>
        )}
        {!inStock && (
          <span className="absolute left-4 top-4 rounded px-2.5 py-1 text-xs font-bold tracking-wide bg-brand-charcoal/70 text-white">
            OUT OF STOCK
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, index) => (
            <button
              key={img.id ?? img.url}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-pressed={activeIndex === index}
              className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:size-20 ${
                activeIndex === index ? "border-brand-red" : "border-transparent hover:border-brand-charcoal/20"
              }`}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
