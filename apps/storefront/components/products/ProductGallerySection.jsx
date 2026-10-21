import Image from "next/image";

// Large-format reuse of the same product images shown as hero/thumbnails
// above — see ProductImageGallery.jsx. Caps at 3 so the section stays a
// deliberate "a few hero shots" gallery rather than a long scroll.
const MAX_GALLERY_IMAGES = 3;

export default function ProductGallerySection({ images, name }) {
  const shown = images.slice(0, MAX_GALLERY_IMAGES);
  if (shown.length === 0) return null;

  return (
    <div
      className={`grid grid-cols-1 gap-4 ${shown.length === 2 ? "sm:grid-cols-2" : ""} ${
        shown.length >= 3 ? "sm:grid-cols-3" : ""
      }`}
    >
      {shown.map((img, index) => (
        <div
          key={img.id ?? img.url}
          className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-brand-cream shadow-sm"
        >
          <Image
            src={img.url}
            alt={img.altText || `${name} — photo ${index + 1}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
