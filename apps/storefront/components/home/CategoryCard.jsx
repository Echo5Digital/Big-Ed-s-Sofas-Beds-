import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Sofa,
  BedDouble,
  Bed,
  UtensilsCrossed,
  Armchair,
  LayoutGrid,
  Grid3x3,
  Briefcase,
  Sparkles,
} from "lucide-react";

// Real category photography, supplied for the homepage's featured categories.
// Matched by slug — see packages/database/prisma/seed.js for the category
// slugs these correspond to.
const CATEGORY_PHOTOS = {
  sofas: "/sofa.webp",
  sectionals: "/sectionals.webp",
  recliners: "/recliner.webp",
  bedroom: "/bedroom.webp",
  mattresses: "/mattresses.webp",
  dining: "/dining_set.webp",
  "living-room": "/living_room.webp",
  office: "/office.webp",
  accessories: "/accessories.webp",
};

// Other categories (e.g. Beds — shown on /shop) have no supplied
// photography yet (see docs/requirements/open-questions.md — "Blocks: Real
// catalog data"), so they fall back to a themed icon instead of a
// placeholder/broken image.
const CATEGORY_ICONS = {
  "living-room": Sofa,
  bedroom: BedDouble,
  mattresses: Bed,
  dining: UtensilsCrossed,
  office: Briefcase,
  accessories: Sparkles,
  sofas: Sofa,
  sectionals: Grid3x3,
  recliners: Armchair,
  beds: BedDouble,
};

export default function CategoryCard({ category }) {
  const photo = CATEGORY_PHOTOS[category.slug];
  const Icon = CATEGORY_ICONS[category.slug] ?? LayoutGrid;

  return (
    <Link
      href={`/shop/${category.slug}`}
      aria-label={`Shop ${category.name}`}
      className="group relative flex aspect-4/3 w-full items-end overflow-hidden rounded-xl bg-gradient-to-b from-brand-red/10 to-brand-red/5 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
    >
      {photo ? (
        <>
          <Image
            src={photo}
            alt={category.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="relative flex w-full items-center justify-between gap-2 p-3">
            <span className="text-sm font-bold text-white sm:text-base">{category.name}</span>
            <ChevronRight
              className="size-4 shrink-0 text-white transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </>
      ) : (
        <div className="flex w-full flex-col items-center justify-center gap-2 py-6">
          <Icon
            className="size-10 shrink-0 text-brand-red transition-transform duration-300 group-hover:scale-110 sm:size-12"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span className="flex items-center gap-1 text-sm font-bold text-brand-charcoal sm:text-base">
            {category.name}
            <ChevronRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      )}
    </Link>
  );
}
