import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import Button from "@/components/ui/Button";
import BearMascot from "@/components/ui/BearMascot";

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-brand-charcoal">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1800&h=900&fit=crop&q=80"
          alt="Elegant warm living room with a cream sectional sofa, wooden coffee table, and tasteful decor"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      <p className="font-script absolute right-6 top-6 hidden -rotate-2 text-xl text-white/90 drop-shadow sm:block md:right-12 md:top-10 md:text-2xl">
        Your Style. Our Commitment.
      </p>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-10 pt-10 sm:px-6 md:min-h-[560px] md:flex-row md:items-center md:pb-16 md:pt-16 lg:px-10">
        <div className="flex justify-center md:w-[260px] md:shrink-0 md:justify-start lg:w-[320px]">
          <BearMascot className="h-48 w-48 drop-shadow-2xl sm:h-56 sm:w-56 md:h-72 md:w-72" pose="wave" />
        </div>

        <div className="flex flex-col items-start gap-5 text-left">
          <h1 className="font-display text-stroke-dark text-4xl font-bold leading-[1.05] text-brand-gold drop-shadow-[0_4px_0_rgba(0,0,0,0.35)] sm:text-5xl md:text-6xl">
            Big Comfort.
            <br />
            Bigger Savings.
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
            <Button href="#" variant="gold" size="lg" icon={MapPin} iconPosition="left">
              Visit Our Showroom
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
