"use client";

import { useState } from "react";
import Image from "next/image";

// Hero image + thumbnail strip for the purchase column. The full image list
// (same ProductImage rows, see apps/api/src/routes/catalog.routes.js) is
// reused again further down the page as the large-format gallery section —
// there's no separate "gallery" image set, just a different layout of the
// same ordered list.
export default function ProductImageGallery({ images, name, inStock }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-brand-cream shadow-sm">
        {active && (
          <Image
            src={active.url}
            alt={active.altText || name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
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
