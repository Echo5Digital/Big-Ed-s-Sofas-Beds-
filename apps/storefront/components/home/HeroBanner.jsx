import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-brand-charcoal">
      <div className="relative h-56 w-full sm:h-72 lg:hidden">
        <Image
          src="/images/hero/big-ed-banner.webp"
          alt="Big Ed mascot giving a thumbs up"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[15%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal via-transparent to-transparent" />
      </div>

      <div className="absolute inset-0 hidden lg:block">
        <Image
          src="/images/hero/big-ed-banner.webp"
          alt="Big Ed mascot giving a thumbs up beside an elegant warm living room with a cream sectional sofa"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-10 pt-6 sm:px-6 lg:min-h-140 lg:flex-row lg:items-center lg:pb-16 lg:pt-16 lg:px-10">
        <div className="hidden shrink-0 lg:block lg:w-65 xl:w-80" aria-hidden="true" />

        <div className="flex flex-col items-start gap-5 text-left">
          <h1 className="flex flex-col gap-1.5">
            <span className="font-poster hero-gold-text w-fit -skew-x-3 rounded-md bg-gradient-to-b from-brand-red to-brand-red-dark px-4 py-1 text-4xl leading-[1.1] sm:text-5xl md:text-6xl">
              Big Comfort.
            </span>
            <span className="font-poster hero-gold-text w-fit -skew-x-3 rounded-md border-2 border-brand-red bg-gradient-to-b from-brand-red to-brand-red-dark px-4 py-1 text-4xl leading-[1.1] shadow-[0_0_0_2px_rgba(0,0,0,0.5)] sm:text-5xl md:text-6xl">
              Bigger Savings.
            </span>
          </h1>

          <p className="max-w-xl text-sm font-bold uppercase tracking-wide text-white sm:text-base">
            Sofas &bull; Sectionals &bull; Beds &bull; Mattresses
            <br />
            Recliners &bull; Dining Sets &amp; More!
          </p>

          <p className="max-w-md text-base text-white/85 sm:text-lg">
            Quality furniture. Affordable style. Comfort for life.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button href="#" variant="primary" size="lg" icon={ArrowRight}>
              Shop Now
            </Button>
            <Button href="#" variant="gold" size="lg" icon={ArrowRight}>
              Visit Our Showroom
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
