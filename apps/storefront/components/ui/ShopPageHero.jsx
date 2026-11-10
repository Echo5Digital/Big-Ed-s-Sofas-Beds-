import Image from "next/image";
import Container from "@/components/ui/Container";

// Image-background hero for the shop/product surfaces only (/shop,
// /shop/[category], product detail) — deliberately a separate component from
// PageHero, which stays the dark-charcoal-plus-mascot banner used by every
// other page (cart, checkout, account, etc.). Text-only, no mascot: a dark
// gradient over the photo keeps the gold title and white subtitle readable
// regardless of how bright the underlying image is, matching the contrast
// technique HeroBanner (components/home/HeroBanner.jsx) already uses on the
// homepage.
export default function ShopPageHero({ title, subtitle }) {
  return (
    <section className="relative min-h-72 overflow-hidden bg-brand-charcoal sm:min-h-80 lg:min-h-96">
      <div className="absolute inset-0 h-full w-full">
        <Image
          src="/Shop your dream furniture BigED.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 1440px) 100vw, 1440px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-charcoal/65 via-brand-charcoal/30 to-transparent" />
      </div>

      <Container className="relative flex min-h-72 flex-col items-center justify-center gap-3 py-10 text-center sm:min-h-80 lg:min-h-96">
        <h1 className="max-w-xl font-display text-3xl font-bold text-brand-gold drop-shadow-md sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-xl text-base text-white/90 drop-shadow-md sm:text-lg">{subtitle}</p>
        )}
      </Container>
    </section>
  );
}
