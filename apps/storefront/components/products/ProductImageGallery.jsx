"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

// How far "into" the image the magnifier lens looks, relative to the lens
// size — e.g. 2.5 means the lens shows a region 2.5x smaller than the lens
// itself, so the zoomed view appears at 2.5x magnification.
const ZOOM_LEVEL = 2.5;

// Hero image + thumbnail strip for the purchase column. The full image list
// (same ProductImage rows, see apps/api/src/routes/catalog.routes.js) is
// reused again further down the page as the large-format gallery section —
// there's no separate "gallery" image set, just a different layout of the
// same ordered list.
//
// A product's first video (if any) is spliced in as the second media item —
// right after the primary image — rather than appended at the end, so a
// shopper sees it while still near the top of the gallery instead of having
// to scroll/click through every photo first. Only the first video is shown
// here; this is the PDP gallery only — the product CARD's hover-swap
// (components/home/ProductCard.jsx) stays image-only and untouched.
export default function ProductImageGallery({ images, videos, name, inStock, discountPercent }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(null);
  const frameRef = useRef(null);

  const media = useMemo(() => {
    const items = images.map((img) => ({ type: "image", ...img }));
    const firstVideo = videos?.[0];
    if (firstVideo) {
      items.splice(1, 0, { type: "video", ...firstVideo });
    }
    return items;
  }, [images, videos]);

  const active = media[activeIndex] ?? media[0];

  function handleMouseMove(e) {
    if (active?.type === "video") return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={frameRef}
        onMouseEnter={handleMouseMove}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoom(null)}
        className="group relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-brand-charcoal/10 bg-brand-cream shadow-sm"
      >
        {active && active.type === "video" ? (
          // No magnifier lens for video — zooming a playing video doesn't
          // make sense the way it does for a still photo.
          <video
            key={active.id ?? active.url}
            src={active.url}
            controls
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : active ? (
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
        ) : null}
        {!inStock && (
          <span className="absolute left-4 top-4 rounded px-2.5 py-1 text-xs font-bold tracking-wide bg-brand-charcoal/70 text-white">
            OUT OF STOCK
          </span>
        )}
        {inStock && discountPercent > 0 && (
          <span className="absolute left-4 top-4 rounded bg-brand-red px-2.5 py-1 text-xs font-bold tracking-wide text-white">
            {discountPercent}% OFF
          </span>
        )}
      </div>

      {media.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {media.map((item, index) => (
            <button
              key={item.id ?? item.url}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={item.type === "video" ? "Play product video" : `Show image ${index + 1} of ${media.length}`}
              aria-pressed={activeIndex === index}
              className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-brand-cream transition-colors sm:size-20 ${
                activeIndex === index
                  ? "border-brand-red shadow-sm"
                  : "border-brand-charcoal/10 hover:border-brand-charcoal/30"
              }`}
            >
              {item.type === "video" ? (
                <>
                  <video src={item.url} muted playsInline preload="metadata" className="size-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <Play className="size-5 fill-white text-white" aria-hidden="true" />
                  </span>
                </>
              ) : (
                <Image src={item.url} alt="" fill sizes="80px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
