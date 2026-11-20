import Image from "next/image";
import { BedDouble, Flame, Sofa, Tag } from "lucide-react";
import Container from "@/components/ui/Container";

// /grand-opening-sale's own hero — the real promo artwork
// (public/Grand_Opening_Doorbusters.webp, 1828x860: mascot at far left, a
// light empty-wall band across the middle, furniture center-right).
//
// lg+ is untouched from the original design: the section takes the image's
// own aspect ratio and shows it uncropped (`object-contain`), with copy
// absolutely inset onto the empty-wall band via percentages so it tracks
// that spot at any width — that layout was already correct on desktop.
//
// Below lg, taking the image's native (very wide) aspect ratio crushed the
// section down to a sliver, forcing the copy to near-illegible sizes. Below
// lg the hero instead gets a fixed min-height plus `object-cover` (pinned
// toward the wall band, away from the mascot) and the copy is laid out
// normally in flow with a readable type scale and a scrim behind it.
const HIGHLIGHTS = [
  { icon: BedDouble, label: "Bedroom Sets" },
  { icon: Sofa, label: "Sofas & Sectionals" },
  { icon: Tag, label: "Doorbuster Pricing" },
];

export default function SaleHeader() {
  return (
    <header className="relative w-full overflow-hidden bg-[#fbe8d3] lg:bg-transparent">
      <div className="relative min-h-[26rem] w-full sm:min-h-[30rem] lg:aspect-[1828/860] lg:min-h-0">
        <Image
          src="/Grand_Opening_Doorbusters.webp"
          alt="Big Ed's Sofas & Beds mascot with grand opening furniture — bedroom and living room sets"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[32%_center] sm:object-[12%_center] lg:object-contain"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#fbe8d3] via-[#fbe8d3]/85 to-transparent sm:from-[#fbe8d3]/98 sm:via-[#fbe8d3]/70 sm:to-transparent lg:hidden" />

        {/* Below lg: copy in normal flow over the min-height/object-cover image. */}
        <Container className="relative flex h-full min-h-[26rem] flex-col justify-center py-10 sm:min-h-[30rem] lg:hidden">
          <div className="flex max-w-xs flex-col items-start sm:max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-3 py-1 text-xs font-extrabold tracking-wide text-white uppercase shadow-md sm:gap-2 sm:px-4 sm:py-1.5 sm:text-sm">
              <Flame className="size-3.5 sm:size-4" strokeWidth={2.5} aria-hidden="true" />
              Limited Time Only
            </span>

            <h1 className="mt-3 font-display text-4xl leading-[1.1] font-bold tracking-tight text-brand-charcoal sm:mt-4 sm:text-5xl sm:leading-[1.15]">
              <span className="block">Grand Opening</span>
              <span className="text-3d-gold block">Sale</span>
            </h1>

            <p className="mt-3 max-w-xs text-base leading-snug text-brand-charcoal/70 sm:mt-4 sm:max-w-sm sm:text-lg">
              Big savings on beds, bedroom sets, sofas, sectionals and recliners for a limited time.
            </p>

            <ul className="mt-4 flex flex-col items-start gap-2 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2.5">
              {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-sm font-semibold text-brand-charcoal sm:gap-2 sm:text-base"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-charcoal sm:size-7">
                    <Icon className="size-3.5 sm:size-4" aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            <a
              href="#sale-products-heading"
              className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-red px-6 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-brand-red-dark sm:mt-6 sm:px-8 sm:py-3.5 sm:text-lg"
            >
              Shop The Sale
            </a>
          </div>
        </Container>

        {/* lg+: original design — copy inset onto the empty-wall band. */}
        <div className="absolute inset-[1%_2%_30%_28%] hidden lg:flex lg:flex-col lg:items-start lg:justify-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-1.5 text-sm font-extrabold tracking-wide text-white uppercase shadow-md lg:text-base">
            <Flame className="size-4 lg:size-5" strokeWidth={2.5} aria-hidden="true" />
            Limited Time Only
          </span>

          <h1 className="mt-4 font-display text-4xl leading-[1.15] font-bold tracking-tight text-brand-charcoal lg:text-5xl xl:text-6xl">
            <span className="block">Grand Opening</span>
            <span className="text-3d-gold block">Sale</span>
          </h1>

          <p className="mt-3 max-w-md text-lg leading-snug text-brand-charcoal/70 lg:text-xl">
            Big savings on beds, bedroom sets, sofas, sectionals and recliners for a limited time.
          </p>

          <ul className="mt-5 flex flex-row flex-wrap items-center gap-x-5 gap-y-2.5">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-base font-semibold text-brand-charcoal lg:text-lg">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-charcoal lg:size-8">
                  <Icon className="size-4 lg:size-4.5" aria-hidden="true" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <a
            href="#sale-products-heading"
            className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-red px-8 py-3.5 text-lg font-bold text-white shadow-md transition-colors hover:bg-brand-red-dark lg:text-xl"
          >
            Shop The Sale
          </a>
        </div>
      </div>
    </header>
  );
}
