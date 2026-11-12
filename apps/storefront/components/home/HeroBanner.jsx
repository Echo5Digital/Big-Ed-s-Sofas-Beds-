import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingCart, Store, Sofa, BedDouble, ShieldCheck } from "lucide-react";
import PromoTicker from "@/components/home/PromoTicker";
import Container from "@/components/ui/Container";

// The background image (public/1000227603.jpeg, 1600x599) has the Big Ed's
// mascot at its far left leaning his forearm on an invisible vertical edge, a
// pitch-black strip for copy in the middle, and the lit showroom on the right.
// The eyebrow/headline/subheadline/bullets/CTAs are live markup over it.
//
// lg and up: the image is pinned left (object-left) so the mascot is never
// cropped, and the copy block's gold left line sits exactly where he leans.
// BEAR_LINE_X is that spot (x = 255 of the image's 1600px) scaled by the same
// factor object-cover uses, max(width / 1600, minHeight / 599), so the line
// tracks him at every width. The hero takes the image's own aspect ratio (never
// shorter than 34rem), so the whole banner shows uncropped on wide screens.
// Below lg there is no room beside the mascot, so the image is pinned right
// (the showroom) and the dark gradients keep the copy legible.
const BEAR_LINE_X = "calc(255 * max(100% / 1600, 34rem / 599))";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-bold tracking-tight whitespace-nowrap transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-8 sm:py-3.5 sm:text-lg";

const FEATURES = [
  { icon: Sofa, label: "Unbeatable Deals on Sofas" },
  { icon: BedDouble, label: "Beds at Unbeatable Prices" },
  { icon: ShieldCheck, label: "Premium Quality & Lasting Comfort" },
];

export default function HeroBanner() {
  return (
    // On phones the hero fills the first screen except for a 4rem peek of the
    // trust strip: its height is the viewport (svh) minus the sticky header
    // (SiteHeader publishes the real height as --header-height; 9.75rem = 156px
    // is the phone header's actual height, used until that runs so nothing
    // jumps when it does) minus the 4rem peek. sm and up are unchanged. The
    // bottom padding on phones (pb-18 = 4.5rem) plus that 4rem peek = 8.5rem
    // keeps the CTAs clear of the fixed Call / WhatsApp buttons, which float
    // 8rem above the bottom of the screen.
    <section className="relative flex flex-col bg-black max-sm:min-h-[calc(100svh_-_var(--header-height,9.75rem)_-_4rem)] sm:block">
      <PromoTicker />

      <div
        className="relative min-h-[32rem] overflow-hidden max-sm:flex max-sm:flex-1 max-sm:flex-col sm:min-h-[36rem] lg:flex lg:aspect-[1600/599] lg:min-h-[34rem] lg:w-full lg:flex-col"
        style={{ "--bear-line-x": BEAR_LINE_X }}
      >
        <Image
          src="/1000227603.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right lg:object-left"
        />
        {/* lg and up: no overlay at all — the image is already black where the
            copy sits, and a scrim would dull the mascot. Below lg the showroom
            side of the image is shown, so the copy needs help: tablet gets a
            side scrim plus a soft top/bottom vignette, and phones anchor the
            copy to the bottom over a bottom-weighted gradient, like a film
            poster — the photo stays visible up top and the copy sits in its
            own legible zone instead of being boxed into a separate card. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/60 to-black sm:hidden" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-black/80 via-black/45 to-transparent sm:block lg:hidden" />
        <div className="absolute inset-0 hidden bg-gradient-to-b from-black/35 via-transparent to-black/40 sm:block lg:hidden" />

        <Container className="relative flex min-h-[32rem] flex-col justify-end pt-10 pb-18 max-sm:flex-1 sm:min-h-[36rem] sm:justify-center sm:py-14 lg:min-h-0 lg:max-w-none lg:flex-1 lg:py-8 lg:pl-(--bear-line-x)">
          <div className="flex flex-col gap-5 sm:gap-6 lg:max-w-[44rem] lg:border-l-2 lg:border-brand-gold/70 lg:pl-8">
            <div className="max-w-xl">
              <div className="mb-4 flex items-center gap-3 sm:mb-4">
                <span className="h-px w-8 bg-brand-gold sm:w-10" />
                <span className="font-sans text-xs font-semibold tracking-[0.2em] text-white uppercase sm:text-sm">
                  Big Ed&rsquo;s Sofas &amp; Beds
                </span>
                <span className="h-px w-8 bg-brand-gold sm:w-10" />
              </div>

              <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl sm:leading-tight lg:text-7xl">
                <span className="block bg-gradient-to-b from-white via-neutral-200 to-neutral-400 bg-clip-text pb-1 text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                  Grand Opening
                </span>
                <span className="block bg-gradient-to-b from-[#ffe9a8] via-brand-gold to-[#b8790f] bg-clip-text pb-1 text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                  Doorbusters!
                </span>
              </h1>

              <p className="mt-4 font-display text-xl text-white/90 italic sm:mt-4 sm:text-2xl">
                Big Comfort. Bigger Savings.
              </p>
            </div>

            <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2 sm:text-base sm:font-semibold sm:text-white">
              {FEATURES.map(({ icon: Icon, label }, index) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 text-sm font-semibold text-white sm:gap-1.5 sm:text-base"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-charcoal sm:size-8">
                    <Icon className="size-4 sm:size-4.5" aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                  {index < FEATURES.length - 1 && (
                    <span className="ml-3 hidden h-5 w-px bg-white/30 sm:block lg:hidden" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                href="/grand-opening-sale"
                className={`${BUTTON_BASE} w-full border-transparent bg-gradient-to-b from-[#ffd43b] to-[#f7a900] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_14px_rgba(0,0,0,0.5)] sm:w-auto`}
              >
                <ShoppingCart className="size-4 shrink-0 sm:size-5" strokeWidth={2.5} aria-hidden="true" />
                <span>Shop Grand Opening Deals</span>
                <ArrowRight className="size-4 shrink-0 sm:size-5" strokeWidth={2.5} aria-hidden="true" />
              </Link>
              <Link
                href="/about"
                className={`${BUTTON_BASE} w-full border-white/70 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 sm:w-auto sm:border-white/80`}
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
