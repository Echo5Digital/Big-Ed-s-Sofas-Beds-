import Image from "next/image";
import { benefits } from "@/lib/mock-data/site-config";
import Container from "@/components/ui/Container";

const STICKERS = {
  showroom: "/Big Ed’s Local Showroom Mascot Sticker.webp",
  delivery: "/Big Ed’s Fast Delivery Sticker.webp",
  financing: "/Big Ed’s Flexible Financing Bear.webp",
  quality: "/Big Ed’s Quality Furniture Mascot.webp",
  prices: "/Big Ed’s Great Prices Badge.webp",
};

function PawPrint({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <ellipse cx="32" cy="42" rx="18" ry="14" />
      <ellipse cx="14" cy="20" rx="7" ry="9" transform="rotate(-20 14 20)" />
      <ellipse cx="32" cy="12" rx="7.5" ry="9.5" />
      <ellipse cx="50" cy="20" rx="7" ry="9" transform="rotate(20 50 20)" />
    </svg>
  );
}

export default function BenefitsSection() {
  return (
    <>
      {/* Heading section */}
      <section className="relative overflow-hidden bg-brand-cream pt-14 pb-6 sm:pt-16">
        <PawPrint className="absolute top-4 left-4 size-14 -rotate-12 fill-brand-red/10 sm:size-20 lg:left-16" />
        <PawPrint className="absolute top-10 right-6 size-10 rotate-12 fill-brand-gold/20 sm:size-16 lg:right-20" />
        <Container>
          <h2 className="font-display text-stroke-dark relative text-center text-4xl leading-none font-bold text-brand-gold drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl lg:text-6xl">
            Why Shop <span className="text-brand-red">Big Ed&rsquo;s</span>?
          </h2>
        </Container>
      </section>

      {/* Benefit cards section */}
      <section className="bg-brand-cream pt-4 pb-14 sm:pb-16">
        <Container>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
            {benefits.map((benefit) => (
              <div
                key={benefit.id}
                className="flex flex-col items-center gap-3 rounded-2xl border border-brand-charcoal/10 bg-white px-3 py-5 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative size-20 shrink-0 sm:size-24">
                  <Image
                    src={STICKERS[benefit.id]}
                    alt={benefit.title}
                    fill
                    sizes="(max-width: 640px) 80px, 96px"
                    className="object-contain"
                  />
                </div>
                <h3 className="font-display text-sm font-bold text-brand-charcoal sm:text-base">
                  {benefit.title}
                </h3>
                <p className="whitespace-pre-line text-xs text-brand-charcoal/70 sm:text-sm">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
