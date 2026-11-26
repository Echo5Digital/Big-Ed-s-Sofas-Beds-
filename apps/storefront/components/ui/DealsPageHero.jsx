import Image from "next/image";
import Container from "@/components/ui/Container";

// Image-background hero for /deals only — same technique as SaleHeader
// (components/sale/SaleHeader.jsx) for a wide (2048x768) banner image: the
// section takes the image's own aspect ratio so object-cover never
// over-crops it, with a min-height floor below sm so it doesn't get too
// short to read on narrow phones. The image's plain wall spans the full
// left ~45% of the frame at any height (clear of the decorative corner
// graphic, which only occupies thin top-left/bottom-left bands), so copy
// stays left-aligned and vertically centered at every breakpoint — the
// gradient direction is the only thing that changes (top-to-bottom below
// sm, where the crop is short/wide and that's the stronger axis;
// left-to-right at sm+ to match the image's own layout). Kept as its own
// component (not a ShopPageHero/PageHero prop) since those two are already
// shared across other pages and this hero's image/copy are deals-specific.
export default function DealsPageHero({ title, subtitle }) {
  return (
    <section className="relative min-h-80 overflow-hidden bg-brand-charcoal sm:aspect-8/3 sm:min-h-0">
      <div className="absolute inset-0 h-full w-full">
        <Image
          src="/Deals_Big_EDs.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-charcoal/85 via-brand-charcoal/35 to-transparent sm:bg-gradient-to-r sm:from-brand-charcoal/65 sm:via-brand-charcoal/30 sm:to-transparent" />
      </div>

      <Container className="relative flex h-full min-h-80 flex-col items-start justify-center gap-2 py-8 text-left sm:gap-3 sm:py-10">
        <h1 className="max-w-52 font-display text-2xl leading-tight font-bold text-brand-gold drop-shadow-md sm:max-w-xl sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-60 text-xs leading-snug text-white/90 drop-shadow-md sm:max-w-xl sm:text-base lg:text-lg">{subtitle}</p>
        )}
      </Container>
    </section>
  );
}
