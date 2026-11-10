import { getImageProps } from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PromoTicker from "@/components/home/PromoTicker";

// The banner artwork already contains the headline, tagline and mascot, so it
// is rendered uncropped at its native 1500x501 ratio (cropping would cut off
// the text) and `unoptimized` so the original file is served byte-for-byte —
// Next's optimizer would otherwise re-encode it at lower quality.
//
// Below the sm breakpoint (phones) a portrait poster is shown instead of that
// wide strip, which would be a thin band with tiny text on a narrow screen. It
// is swapped with <picture>, so each device downloads only the file it shows.
// The poster's text ends at y=1240 of 1536; below that is an empty black band
// (then a swoosh), so on phones it is cropped to 4:5 (y<=1280) to sit the CTA
// buttons right under the text. The background is ~rgb(9,9,9), so the cut is
// seamless against the black bar below.
//
// On xl+ the CTA buttons are overlaid on the image, in the empty band under
// the "Unbeatable Deals" tagline. Measured on the 1500x501 artwork, that band
// runs from y=412 (bottom of the tagline) to y=501, i.e. ~5.9% of the image
// width tall, and the mascot's overalls reach x~334 at its left. Everything
// here is sized in container-query units (`cqw` = 1% of the banner's width) so
// the buttons scale with the artwork and keep the same clearance at any width:
//   ~1.1cqw gap above  +  3.3cqw button  +  ~1.5cqw gap below  = 5.9cqw band
// (If the banner artwork is swapped, re-measure that band and adjust the
// `xl:bottom-[...]` offset below.)
// and the pair is centred on the tagline (x ~ 44% of the width). Below xl the
// banner is too small for legible, tappable overlaid buttons, so they drop onto
// a dark bar beneath the image instead.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 px-6 py-3 text-base font-bold tracking-tight whitespace-nowrap transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-8 sm:py-3.5 sm:text-lg " +
  "xl:h-[3.3cqw] xl:gap-[0.6cqw] xl:border-[0.12cqw] xl:px-[2cqw] xl:py-0 xl:text-[1.15cqw]";

const ARROW = "size-5 shrink-0 xl:size-[1.35cqw]";

const BANNER_ALT =
  "Big Ed the bear giving a thumbs up. Big Ed's Sofas & Beds Grand Opening Doorbusters: Big Comfort. Bigger Savings. Unbeatable deals on sofas, beds and recliners.";

// <source srcset> splits on whitespace, so the spaces and parentheses in these
// file names have to be percent-encoded.
const encodeSrc = (src) => encodeURI(src).replace(/\(/g, "%28").replace(/\)/g, "%29");

// Same art-direction pattern as the Next.js docs: getImageProps() gives the
// right <img> attributes and `unoptimized` serves the files untouched. (It does
// not turn `priority` into a fetch hint, so fetchPriority is set on the <img>
// below — this is the above-the-fold image for whichever file the browser picks.)
const bannerCommon = { alt: BANNER_ALT, unoptimized: true };
const { props: desktopBanner } = getImageProps({
  ...bannerCommon,
  src: encodeSrc("/Big Eds Sofas  Beds Grand Opening.jpeg"),
  width: 1500,
  height: 501,
});
const { props: mobileBanner } = getImageProps({
  ...bannerCommon,
  src: encodeSrc("/Big Eds Grand Opening Doorbusters (1).jpeg"),
  width: 1024,
  height: 1536,
});

export default function HeroBanner() {
  return (
    <section className="bg-black">
      <h1 className="sr-only">
        Big Ed&apos;s Sofas &amp; Beds Grand Opening Doorbusters. Big Comfort. Bigger Savings.
      </h1>

      <PromoTicker />

      <div className="@container relative mx-auto w-full max-w-[1920px]">
        <picture>
          <source
            media="(min-width: 640px)"
            srcSet={desktopBanner.src}
            width={desktopBanner.width}
            height={desktopBanner.height}
          />
          <img
            {...mobileBanner}
            alt={BANNER_ALT}
            fetchPriority="high"
            className="aspect-4/5 h-auto w-full object-cover object-top sm:aspect-auto"
          />
        </picture>

        <div className="flex flex-col items-stretch justify-center gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:py-5 xl:absolute xl:bottom-[1.5cqw] xl:left-[44cqw] xl:w-max xl:-translate-x-1/2 xl:gap-[1.1cqw] xl:p-0">
          <Link
            href="/grand-opening-sale"
            className={`${BUTTON_BASE} border-neutral-300 bg-gradient-to-b from-[#e3101c] to-[#a30610] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(0,0,0,0.5)]`}
          >
            <span>Shop Grand Opening Deals</span>
            <ArrowRight className={ARROW} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <Link
            href="/about"
            className={`${BUTTON_BASE} border-transparent bg-gradient-to-b from-[#ffd43b] to-[#f7a900] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_14px_rgba(0,0,0,0.5)]`}
          >
            <span>Visit Our Showroom</span>
            <ArrowRight className={ARROW} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
