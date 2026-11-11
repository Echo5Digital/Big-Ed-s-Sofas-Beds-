"use client";

import { ImageOff } from "lucide-react";

// Consistent thumbnail size/aspect ratio everywhere a product image appears
// in POS (search results, cart lines, return/exchange screens). object-contain
// keeps the whole product visible rather than cropping it, and a gray
// placeholder with an icon stands in when a product has no image.
export default function ProductThumbnail({ src, alt, className = "" }) {
  return (
    <span
      className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-white ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Cloudinary/remote URLs, no next/image domain config for POS
        <img src={src} alt={alt ?? ""} className="size-full object-contain" />
      ) : (
        <ImageOff className="size-5 text-brand-charcoal/25" aria-hidden="true" />
      )}
    </span>
  );
}
