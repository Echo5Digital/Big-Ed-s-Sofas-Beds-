import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import Container from "@/components/ui/Container";
import DoorbusterBook from "@/components/home/DoorbusterBook";

// The same 10 grand-opening promo flyers shown via ImageCarousel on
// /grand-opening-sale (bedroom flyers B1-B6, living room flyers S1-S4) —
// reused here as slides in DoorbusterBook's 3D coverflow carousel, in a
// fixed shuffled order (not randomized at render time, so server/client
// markup always matches).
const DOORBUSTER_FLYER_IMAGES = [
  { src: "/BIGEDS SOFAS & BEDS S3.webp", alt: "Big Ed's Sofas & Beds grand opening living room flyer — Blush Collection" },
  { src: "/BIGEDS SOFAS & BEDS B1.webp", alt: "Big Ed's Sofas & Beds grand opening bedroom flyer — Beech Collection" },
  { src: "/BIGEDS SOFAS & BEDS S1.webp", alt: "Big Ed's Sofas & Beds grand opening living room flyer — Accent Collection" },
  { src: "/BIGEDS SOFAS & BEDS B4.webp", alt: "Big Ed's Sofas & Beds grand opening bedroom flyer — Cotton Collection" },
  { src: "/BIGEDS SOFAS & BEDS S4.webp", alt: "Big Ed's Sofas & Beds grand opening living room flyer — Phyll Collection" },
  { src: "/BIGEDS SOFAS & BEDS B6.webp", alt: "Big Ed's Sofas & Beds grand opening bedroom flyer — Lus Collection 4pc set" },
  { src: "/BIGEDS SOFAS & BEDS B2.webp", alt: "Big Ed's Sofas & Beds grand opening bedroom flyer — Lus Collection" },
  { src: "/BIGEDS SOFAS & BEDS S2.webp", alt: "Big Ed's Sofas & Beds grand opening living room flyer — Ela Collection" },
  { src: "/BIGEDS SOFAS & BEDS B5.webp", alt: "Big Ed's Sofas & Beds grand opening bedroom flyer — Heir Collection" },
  { src: "/BIGEDS SOFAS & BEDS B3.webp", alt: "Big Ed's Sofas & Beds grand opening bedroom flyer — Ted Collection" },
];

export default function DoorbusterDeals() {
  return (
    <section aria-labelledby="doorbuster-heading" className="relative isolate overflow-hidden bg-linear-to-b from-[#fffdf8] via-[#fff7e6] to-[#fdecc8] pt-10 pb-28 sm:pt-14 sm:pb-36">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,206,48,0.30),transparent_65%)]"
      />

      {/* Confetti ribbons in the top corners, framing the heading. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 hidden h-48 sm:block">
        <svg viewBox="0 0 60 90" className="absolute top-2 left-[6%] h-20 w-14 opacity-90 lg:left-[12%]">
          <path d="M10 5 C 25 15, 5 25, 20 35 C 35 45, 10 55, 25 65" fill="none" stroke="#c9960b" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 60 90" className="absolute top-4 right-[6%] h-20 w-14 -scale-x-100 opacity-90 lg:right-[12%]">
          <path d="M10 5 C 25 15, 5 25, 20 35 C 35 45, 10 55, 25 65" fill="none" stroke="#c9960b" strokeWidth="3" strokeLinecap="round" />
        </svg>
        {[
          ["left-[4%] top-20", "rotate-12", "bg-brand-gold"],
          ["left-[18%] top-6", "-rotate-12", "bg-brand-red"],
          ["right-[4%] top-24", "-rotate-12", "bg-brand-gold"],
          ["right-[18%] top-8", "rotate-12", "bg-brand-red"],
        ].map(([position, rotation, colour]) => (
          <span key={position} className={`absolute size-2.5 rounded-xs ${position} ${rotation} ${colour}`} />
        ))}
      </div>

      <Container className="relative">
        {/* Price-tag eyebrow + plain stacked headline, "Deals" flanked by
            thin gold rules — an editorial promo header rather than a
            party/craft look (no ribbon banner, no starburst script font). */}
        <header className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="relative inline-flex items-center gap-2 rounded-r-md bg-brand-red py-1.5 pr-4 pl-5 text-xs font-bold tracking-[0.15em] text-white uppercase shadow-[0_6px_14px_-4px_rgba(163,6,16,0.45)] sm:py-2 sm:pr-6 sm:pl-7 sm:text-sm">
            <span aria-hidden="true" className="absolute top-1/2 left-2 size-1.5 -translate-y-1/2 rounded-full bg-white/70 sm:left-2.5" />
            <Tag className="size-3.5 sm:size-4" strokeWidth={2.5} aria-hidden="true" />
            Grand Opening Sale
          </span>

          <h2
            id="doorbuster-heading"
            className="mt-4 font-display text-4xl leading-[1.05] font-extrabold text-balance text-brand-charcoal sm:mt-5 sm:text-6xl lg:text-7xl"
          >
            Featured Doorbuster
          </h2>

          <div className="mt-1 flex items-center gap-3 sm:mt-2 sm:gap-5">
            <span aria-hidden="true" className="h-px w-8 bg-brand-gold sm:w-16 lg:w-24" />
            <span className="font-display text-4xl font-extrabold text-brand-red sm:text-6xl lg:text-7xl">Deals</span>
            <span aria-hidden="true" className="h-px w-8 bg-brand-gold sm:w-16 lg:w-24" />
          </div>
        </header>

        <div className="relative z-10 mt-6 sm:mt-10">
          <DoorbusterBook images={DOORBUSTER_FLYER_IMAGES} />
        </div>

        <div className="relative z-10 mt-10 flex items-center justify-center gap-4 sm:mt-14 sm:gap-6">
          <span
            aria-hidden="true"
            className="hidden h-px max-w-64 flex-1 bg-linear-to-r from-transparent to-brand-red/60 sm:block"
          />
          <Link
            href="/grand-opening-sale"
            className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 bg-linear-to-b from-[#e3101c] to-[#8f050f] px-6 py-3.5 text-base font-extrabold text-white shadow-[0_12px_26px_-8px_rgba(163,6,16,0.75),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red sm:px-9 sm:text-xl"
          >
            Shop All Grand Opening Deals
            <ArrowRight className="size-5 shrink-0 sm:size-6" strokeWidth={2.75} aria-hidden="true" />
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-px max-w-64 flex-1 bg-linear-to-l from-transparent to-brand-red/60 sm:block"
          />
        </div>
      </Container>

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full sm:h-20 lg:h-24"
      >
        <defs>
          <linearGradient id="doorbuster-swoosh-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e3101c" />
            <stop offset="1" stopColor="#8f050f" />
          </linearGradient>
        </defs>
        <path d="M0 58 C 240 14, 540 98, 840 56 S 1260 8, 1440 46 L1440 120 L0 120 Z" fill="#ffc400" />
        <path d="M0 84 C 280 46, 560 112, 900 76 S 1280 40, 1440 70 L1440 120 L0 120 Z" fill="url(#doorbuster-swoosh-red)" />
      </svg>
    </section>
  );
}
