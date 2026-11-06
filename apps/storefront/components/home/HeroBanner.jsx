import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-brand-charcoal">
      {/* Mobile background banner */}
      <div className="relative h-60 w-full sm:h-72 lg:hidden">
        <Image
          src="/images/hero/big-ed-banner.webp"
          alt="Big Ed mascot giving a thumbs up"
          fill
          priority
          sizes="(max-width: 1440px) 100vw, 1440px"
          className="object-cover object-[15%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal via-brand-charcoal/40 to-transparent" />
      </div>

      {/* Desktop full-width background image */}
      <div className="absolute inset-0 hidden lg:block">
        <Image
          src="/images/hero/big-ed-banner.webp"
          alt="Big Ed mascot giving a thumbs up beside an elegant warm living room with a cream sectional sofa"
          fill
          priority
          sizes="(max-width: 1440px) 100vw, 1440px"
          className="object-cover"
        />
        {/* Subtle contrast gradient for center content readability without darkening the room */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-charcoal/40 via-transparent to-brand-charcoal/20 pointer-events-none" />
      </div>

      {/* Content container */}
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:min-h-145 lg:flex-row lg:items-center lg:pb-16 lg:pt-16 lg:px-10">
        {/* Spacer to clear the mascot on desktop */}
        <div className="hidden shrink-0 lg:block lg:w-65 xl:w-80" aria-hidden="true" />

        {/* Hero copy block */}
        <div className="flex max-w-xl flex-col items-start gap-4 text-left">
          {/* Eyebrow tag */}
          <div className="flex items-center gap-2.5">
            <span className="h-0.5 w-6 rounded-full bg-brand-gold" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-brand-gold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Direct Showroom Pricing &bull; Quality Furniture
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-serif-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]">
            Big Comfort.
            <span className="mt-1 block text-brand-gold font-extrabold">Bigger Savings.</span>
          </h1>

          {/* Subheading content */}
          <div className="flex flex-col gap-2 max-w-lg">
            <p className="text-base sm:text-lg font-medium text-white/95 leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
              Quality furniture. Affordable style. Comfort for life.
            </p>
            <p className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-brand-gold/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Sofas &bull; Sectionals &bull; Beds &bull; Mattresses &bull; Recliners &bull; Dining Sets
            </p>
          </div>

          {/* Action CTAs with sharp, unblurred text */}
          <div className="flex flex-wrap items-center gap-3 pt-2 [text-shadow:none]">
            <Button
              href="/shop"
              variant="primary"
              size="lg"
              icon={ArrowRight}
              className="font-bold tracking-wide shadow-xl hover:shadow-2xl hover:brightness-110 [text-shadow:none]"
            >
              Shop Now
            </Button>
            <Button
              href="/about"
              variant="gold"
              size="lg"
              icon={ArrowRight}
              className="font-bold tracking-wide text-brand-charcoal shadow-xl hover:shadow-2xl hover:brightness-105 [text-shadow:none]"
            >
              Visit Our Showroom
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
