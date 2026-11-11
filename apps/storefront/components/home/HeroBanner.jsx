import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingCart, Store, Sofa, BedDouble, ShieldCheck } from "lucide-react";
import PromoTicker from "@/components/home/PromoTicker";
import Container from "@/components/ui/Container";

// Unlike the previous banner (a pre-designed JPEG with the headline baked
// into the pixels), this background photo is a plain showroom shot — darkened
// on the left specifically to hold overlaid text — so the eyebrow/headline/
// subheadline/bullets/CTAs below are all live markup, not part of the image.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-bold tracking-tight whitespace-nowrap transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-8 sm:py-3.5 sm:text-lg";

const FEATURES = [
  { icon: Sofa, label: "Unbeatable Deals on Sofas" },
  { icon: BedDouble, label: "Beds at Unbeatable Prices" },
  { icon: ShieldCheck, label: "Premium Quality & Lasting Comfort" },
];

export default function HeroBanner() {
  return (
    <section className="relative bg-black">
      <PromoTicker />

      <div className="relative min-h-[32rem] overflow-hidden sm:min-h-[36rem] lg:min-h-[40rem]">
        <Image
          src="/Big_E_D_Grand_Opening.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Desktop keeps the photo full-bleed with a side scrim (the source
            image is already darkened on its left third) plus a soft top/bottom
            vignette for depth. Mobile instead wraps the copy in its own
            frosted glass card over the photo, rather than darkening the whole
            frame — reads as a deliberate panel instead of text just floating
            over a busy background. */}
        <div className="absolute inset-0 hidden bg-gradient-to-r from-black/80 via-black/45 to-transparent sm:block" />
        <div className="absolute inset-0 hidden bg-gradient-to-b from-black/35 via-transparent to-black/40 sm:block" />

        <Container className="relative flex min-h-[32rem] flex-col justify-center py-8 sm:min-h-[36rem] sm:py-14 lg:min-h-[40rem]">
          <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-black/55 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:gap-6 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
            <div className="max-w-xl lg:border-l-2 lg:border-brand-gold/70 lg:pl-8">
              <div className="mb-3 flex items-center gap-3 sm:mb-4">
                <span className="h-px w-8 bg-brand-gold sm:w-10" />
                <span className="font-sans text-xs font-semibold tracking-[0.2em] text-white uppercase sm:text-sm">
                  Big Ed&rsquo;s Sofas &amp; Beds
                </span>
                <span className="h-px w-8 bg-brand-gold sm:w-10" />
              </div>

              <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-6xl lg:text-7xl">
                <span className="block bg-gradient-to-b from-white via-neutral-200 to-neutral-400 bg-clip-text pb-1 text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                  Grand Opening
                </span>
                <span className="block bg-gradient-to-b from-[#ffe9a8] via-brand-gold to-[#b8790f] bg-clip-text pb-1 text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                  Doorbusters!
                </span>
              </h1>

              <p className="mt-3 font-display text-lg text-white/90 italic sm:mt-4 sm:text-2xl">
                Big Comfort. Bigger Savings.
              </p>
            </div>

            <ul className="flex flex-wrap gap-2 sm:items-center sm:gap-x-5 sm:gap-y-2 sm:text-base sm:font-semibold sm:text-white">
              {FEATURES.map(({ icon: Icon, label }, index) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1.5 pr-3 pl-1.5 text-xs font-semibold text-white sm:border-0 sm:bg-transparent sm:p-0 sm:text-base"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-charcoal sm:size-8">
                    <Icon className="size-3.5 sm:size-4.5" aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                  {index < FEATURES.length - 1 && (
                    <span className="ml-3 hidden h-5 w-px bg-white/30 sm:block" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
              <Link
                href="/grand-opening-sale"
                className={`${BUTTON_BASE} border-transparent bg-gradient-to-b from-[#ffd43b] to-[#f7a900] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_14px_rgba(0,0,0,0.5)]`}
              >
                <ShoppingCart className="size-4 shrink-0 sm:size-5" strokeWidth={2.5} aria-hidden="true" />
                <span>Shop Grand Opening Deals</span>
                <ArrowRight className="size-4 shrink-0 sm:size-5" strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link
                href="/about"
                className={`${BUTTON_BASE} border-white/70 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:border-white/80`}
              >
                <Store className="size-4 shrink-0 sm:size-5" strokeWidth={2.5} aria-hidden="true" />
                <span>Visit Our Showroom</span>
                <ArrowRight className="size-4 shrink-0 sm:size-5" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
