import Link from "next/link";
import { ArrowRight, BedDouble, Flame } from "lucide-react";
import Container from "@/components/ui/Container";
import DealCard from "@/components/home/DealCard";
import SpecialsHeader from "@/components/sale/SpecialsHeader";
import ImageCarousel from "@/components/sale/ImageCarousel";
import LivingRoomSpecials from "@/components/sale/LivingRoomSpecials";

// Grand-opening bedroom flyer set — see docs on ImageCarousel for why these
// are plain decorative images (a carousel, not product cards) shown above
// the real shoppable Bedroom Specials grid below. caption/subcaption match
// what's actually printed on each flyer (collection name + the piece shown).
const BEDROOM_FLYER_CAPTIONS = [
  { caption: "Beech Collection", subcaption: "Weathered-gray panel bed.", priceLabel: "Queen", price: "$259.99" },
  { caption: "Lus Collection", subcaption: "Platform bed with footboard storage & nightstand.", priceLabel: "Queen / King", price: "$489.99 / $589.99" },
  { caption: "Ted Collection", subcaption: "Upholstered curved bed, modern design.", priceLabel: "Queen Bed", price: "Shop Now" },
  { caption: "Cotton Collection", subcaption: "Tufted upholstered headboard bed.", priceLabel: "Queen", price: "$269" },
  { caption: "Heir Collection", subcaption: "Tufted platform bed, available in 2 colors.", priceLabel: "Queen", price: "$289.99" },
  { caption: "Lus Collection", subcaption: "4pc set: bed w/ storage, nightstand, dresser & mirror.", priceLabel: "Queen Set", price: "$849.99" },
];
const BEDROOM_FLYER_IMAGES = [1, 2, 3, 4, 5, 6].map((n, i) => ({
  src: `/BIGEDS SOFAS & BEDS B${n}.webp`,
  alt: `Big Ed's Sofas & Beds bedroom grand opening flyer ${n}`,
  ...BEDROOM_FLYER_CAPTIONS[i],
}));

// Closing banner for the page — dark charcoal + gold accent to bookend the
// hero (SaleHeader), with the same red "limited time" eyebrow pill the hero
// uses so the page opens and closes on matching language. No icon tile and
// no restated deal count here (both already shown earlier on the page) —
// just the urgency pitch and the CTA.
function MoreDealsBanner({ scope }) {
  return (
    <div className="relative mt-12 flex flex-col items-center gap-5 overflow-hidden rounded-2xl bg-brand-charcoal p-6 text-center shadow-md sm:mt-16 sm:flex-row sm:justify-between sm:p-8 sm:text-left">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_0%_0%,rgba(247,191,50,0.14),transparent_60%)]"
      />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white uppercase">
          <Flame className="size-3" strokeWidth={2.5} aria-hidden="true" />
          Ends Soon
        </span>
        <p className="mt-1.5 font-display text-xl font-bold text-white sm:text-2xl">Don&rsquo;t Miss Out</p>
        <p className="mt-0.5 text-sm text-white/60">{scope} — grand opening pricing won&rsquo;t last.</p>
      </div>

      <Link
        href="/deals"
        className="relative inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark sm:text-base"
      >
        Shop All Deals
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </Link>
    </div>
  );
}

// products: the already-chosen bedroom list from getGrandOpeningProducts()
// (lib/grandOpeningSale.js). livingRoomProducts: the living room list from
// getLivingRoomProducts() (lib/livingRoomSale.js), shown below the bedroom
// grid and above the "More Grand Opening Deals" banner.
export default function SaleProducts({ products, livingRoomProducts = [] }) {
  const hasLivingRoom = livingRoomProducts.length > 0;

  return (
    <section aria-labelledby="sale-products-heading" className="bg-brand-cream pt-12 pb-16 sm:pt-16 sm:pb-24">
      <Container>
        <SpecialsHeader
          id="sale-products-heading"
          icon={BedDouble}
          title="Bedroom Specials"
          count={products.length}
          tagline="Stylish & comfortable beds at grand opening prices"
        />

        <div className="mt-8 sm:mt-10">
          <ImageCarousel images={BEDROOM_FLYER_IMAGES} />
        </div>

        {products.length > 0 ? (
          <ul className="relative z-10 mt-10 flex [--cols:2] [--gap:0.75rem] flex-wrap justify-center gap-(--gap) sm:mt-12 sm:[--cols:3] sm:[--gap:1rem] lg:[--cols:4] lg:[--gap:1.25rem] xl:[--cols:5]">
            {products.map((product) => (
              <DealCard key={product.slug} deal={product} size="compact" />
            ))}
          </ul>
        ) : (
          <p className="mt-10 text-center text-base text-brand-charcoal/60">
            Our Grand Opening specials are being restocked &mdash; check back shortly, or{" "}
            <Link href="/shop/bedroom" className="text-brand-red underline underline-offset-4">
              browse all bedroom furniture
            </Link>
            .
          </p>
        )}

        <LivingRoomSpecials products={livingRoomProducts} />

        {(products.length > 0 || hasLivingRoom) && (
          <MoreDealsBanner
            scope={hasLivingRoom ? "Across beds, bedroom sets & living room" : "Across beds & bedroom sets"}
          />
        )}
      </Container>
    </section>
  );
}
