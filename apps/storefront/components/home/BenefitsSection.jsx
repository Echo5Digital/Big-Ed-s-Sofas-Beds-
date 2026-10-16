import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { benefits } from "@/lib/mock-data/site-config";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

const STICKERS = {
  showroom: "/Big Ed’s Local Showroom Mascot Sticker.webp",
  delivery: "/Big Ed’s Fast Delivery Sticker.webp",
  financing: "/Big Ed’s Flexible Financing Bear.webp",
  quality: "/Big Ed’s Quality Furniture Mascot.webp",
  prices: "/Big Ed’s Great Prices Badge.webp",
};

function Burst({ className }) {
  return (
    <svg viewBox="0 0 10 24" className={className} aria-hidden="true">
      <polygon points="5,0 10,24 0,24" />
    </svg>
  );
}

export default function BenefitsSection() {
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-brand-charcoal py-12 sm:py-16">
      <Image
        src="/BigEdsSofas&Beds.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <Container className="relative z-10 flex flex-1 flex-col justify-center gap-10 sm:gap-12">
        <div className="relative mx-auto flex flex-col items-center">
          <span className="font-poster -skew-x-2 rounded-md border-2 border-brand-red-dark bg-gradient-to-b from-brand-red to-brand-red-dark px-6 py-1 text-xl leading-tight text-white shadow-[0_0_0_2px_rgba(0,0,0,0.35)] sm:text-2xl md:text-3xl">
            Why Shop
          </span>

          <div className="relative -mt-2 flex items-center gap-2 sm:gap-3">
            <Burst className="hidden size-8 -rotate-12 fill-brand-gold sm:block md:size-10" />
            <h2 className="font-poster text-stroke-black relative text-5xl leading-none font-normal text-brand-gold drop-shadow-[0_4px_0_rgba(0,0,0,0.9)] sm:text-6xl md:text-7xl lg:text-8xl">
              Big Ed&rsquo;s?
            </h2>
            <Burst className="hidden size-8 rotate-12 fill-brand-gold sm:block md:size-10" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.id}
              className={`relative aspect-2/3 w-full max-w-50 transition-transform hover:-translate-y-1 sm:max-w-none ${
                index === benefits.length - 1 && benefits.length % 2 !== 0
                  ? "col-span-2 mx-auto sm:col-span-1 sm:mx-0"
                  : ""
              }`}
            >
              <Image
                src={STICKERS[benefit.id]}
                alt={benefit.title}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
                className="object-contain"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button href="/contact" variant="gold" size="lg" icon={ArrowRight}>
            Contact Us
          </Button>
        </div>
      </Container>
    </section>
  );
}
