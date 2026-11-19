import Image from "next/image";
import { BedDouble, Flame, Sofa, Tag } from "lucide-react";

// /grand-opening-sale's own hero — the real promo artwork
// (public/Grand_Opening_Doorbusters.webp, 1828x860) as a true full-bleed
// background, shown at its own aspect ratio so it's never cropped (no
// `object-cover`, no forced min-height — the section's height IS the
// image's height at the current width). Copy sits directly on top, pinned
// to the plain-wall band the art leaves open above the sofa (roughly
// x:28-98%, y:0-62% of the source) — expressed as % insets so it tracks
// that same spot at every width instead of a fixed-pixel position, and
// vertically centered within that band rather than hugging its top edge.
// No overlay: that band is already light and empty, so dark text reads
// cleanly straight on the image.
const HIGHLIGHTS = [
  { icon: BedDouble, label: "Bedroom Sets" },
  { icon: Sofa, label: "Sofas & Sectionals" },
  { icon: Tag, label: "Doorbuster Pricing" },
];

export default function SaleHeader() {
  return (
    <header className="relative w-full">
      <div className="relative aspect-[1828/860] w-full">
        <Image
          src="/Grand_Opening_Doorbusters.webp"
          alt="Big Ed's Sofas & Beds mascot with grand opening furniture — bedroom and living room sets"
          fill
          priority
          sizes="100vw"
          className="object-contain"
        />

        <div className="absolute inset-[4%_2%_26%_26%] flex flex-col items-start justify-center sm:inset-[1%_2%_30%_28%] sm:items-start sm:text-left">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-white uppercase shadow-md sm:gap-2 sm:px-4 sm:py-1.5 sm:text-sm lg:text-base">
            <Flame className="size-2.5 sm:size-4 lg:size-5" strokeWidth={2.5} aria-hidden="true" />
            Limited Time Only
          </span>

          <h1 className="mt-1 font-display text-sm leading-[1.1] font-bold tracking-tight text-brand-charcoal sm:mt-4 sm:text-4xl sm:leading-[1.15] lg:text-5xl xl:text-6xl">
            <span className="block">Grand Opening</span>
            <span className="text-3d-gold block">Sale</span>
          </h1>

          <p className="mt-1 max-w-[12rem] text-[8px] leading-snug text-brand-charcoal/70 sm:mt-3 sm:max-w-sm sm:text-lg lg:max-w-md lg:text-xl">
            Big savings on beds, bedroom sets, sofas, sectionals and recliners for a limited time.
          </p>

          <ul className="mt-1 flex flex-col items-start gap-0.5 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2.5">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-1 text-[7px] font-semibold text-brand-charcoal sm:gap-2 sm:text-base lg:text-lg"
              >
                <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-charcoal sm:size-7 lg:size-8">
                  <Icon className="size-2 sm:size-4 lg:size-4.5" aria-hidden="true" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <a
            href="#sale-products-heading"
            className="mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-red px-2.5 py-1 text-[8px] font-bold text-white shadow-md transition-colors hover:bg-brand-red-dark sm:mt-6 sm:px-8 sm:py-3.5 sm:text-lg lg:text-xl"
          >
            Shop The Sale
          </a>
        </div>
      </div>
    </header>
  );
}
