import { BedDouble, Flame, Sofa, Tag } from "lucide-react";
import Container from "@/components/ui/Container";

// /grand-opening-sale's own hero — dark charcoal, matching the calm,
// professional tone PageHero.jsx uses site-wide (cart, checkout, account)
// rather than this page's former carnival-flyer look (confetti, italic
// Montserrat, hand-drawn sparkle marks). No mascot here (dropped per
// feedback) — centered copy block instead of the old side-by-side layout.
//
// Reads as a SALE page rather than a generic page banner: a red "doorbuster"
// pill (same badge convention DealsCarousel uses for its savings corner-tag),
// a two-tone gradient headline (same technique as the homepage HeroBanner's
// "Grand Opening / Doorbusters!" treatment), and a row of icon-chip
// highlights (HeroBanner's FEATURES pattern) plus a CTA that jumps straight
// to the specials grid below — so there's an actual reason to scroll, not
// just a mood-setting banner.
const HIGHLIGHTS = [
  { icon: BedDouble, label: "Bedroom Sets" },
  { icon: Sofa, label: "Sofas & Sectionals" },
  { icon: Tag, label: "Doorbuster Pricing" },
];

export default function SaleHeader() {
  return (
    <header className="relative overflow-hidden bg-brand-charcoal py-14 sm:py-20">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_50%_0%,rgba(247,191,50,0.14),transparent_70%)]"
      />

      <Container className="relative flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-3.5 py-1 text-xs font-extrabold tracking-wide text-white uppercase shadow-md">
          <Flame className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          Limited Time Only
        </span>

        <h1 className="mt-4 font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
          <span className="block text-white">Grand Opening</span>
          <span className="block bg-linear-to-b from-[#ffe9a8] via-brand-gold to-[#b8790f] bg-clip-text text-transparent">
            Sale
          </span>
        </h1>

        <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">
          Big savings on beds, bedroom sets, sofas, sectionals and recliners — for a limited time.
        </p>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, label }, index) => (
            <li key={label} className="flex items-center gap-2 text-sm font-semibold text-white sm:text-base">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-charcoal sm:size-8">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span>{label}</span>
              {index < HIGHLIGHTS.length - 1 && (
                <span className="ml-3 hidden h-5 w-px bg-white/25 sm:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>

        <a
          href="#sale-products-heading"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-brand-red-dark sm:text-base"
        >
          Shop The Sale
        </a>
      </Container>
    </header>
  );
}
