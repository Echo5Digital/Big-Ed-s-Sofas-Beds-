import { Check, ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

const categories = ["Sofas", "Sectionals", "Recliners", "Beds", "Mattresses", "Dining Sets"];

export default function DealsBanner() {
  return (
    <section className="bg-brand-cream py-8 sm:py-10">
      <div
        className="relative mx-auto aspect-2172/724 w-full max-w-[1440px] @container bg-[url(/Big_eds_2.webp)] bg-contain bg-center bg-no-repeat"
        role="img"
        aria-label="UnBEARably Good Deals! Big Ed mascot giving a thumbs up"
      >
        <div className="absolute top-[29%] right-[1.5%] hidden h-[41%] w-[16.5%] flex-col items-center justify-center gap-[2cqh] text-center text-white md:flex">
          <h2 className="font-display text-[0.9cqw] leading-tight font-semibold">
            Comfort for
            <br />
            Every Room.
          </h2>
          <ul className="flex flex-col items-start gap-[0.8cqh] text-[0.65cqw] font-semibold">
            {categories.map((item) => (
              <li key={item} className="flex items-center gap-[0.35cqw]">
                <Check className="size-[0.7cqw] shrink-0 text-brand-gold" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <Button
            href="/deals"
            variant="gold"
            icon={ArrowRight}
            className="gap-[0.3cqw] px-[0.9cqw] py-[0.5cqw] text-[0.65cqw]"
          >
            Shop Deals
          </Button>
        </div>
      </div>

      <Container className="flex flex-col items-center gap-4 pt-6 md:hidden">
        <h2 className="font-display text-2xl font-semibold text-brand-charcoal">Comfort for Every Room.</h2>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-semibold text-brand-charcoal sm:grid-cols-3">
          {categories.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="size-4 shrink-0 text-brand-red" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <Button href="/deals" variant="primary" size="lg" icon={ArrowRight}>
          Shop All Deals
        </Button>
      </Container>
    </section>
  );
}
