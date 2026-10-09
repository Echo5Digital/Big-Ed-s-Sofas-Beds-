import { MapPin, Truck, CreditCard, Gem, Tag } from "lucide-react";
import { benefits } from "@/lib/mock-data/site-config";
import Container from "@/components/ui/Container";

const ICONS = {
  "map-pin": MapPin,
  truck: Truck,
  "credit-card": CreditCard,
  gem: Gem,
  tag: Tag,
};

export default function BenefitsSection() {
  return (
    <section className="bg-brand-cream py-14 sm:py-16">
      <Container>
        <h2 className="font-display text-center text-2xl font-semibold text-brand-charcoal sm:text-3xl">
          Why Shop Big Ed&rsquo;s?
        </h2>

        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-brand-charcoal/10">
          {benefits.map((benefit) => {
            const Icon = ICONS[benefit.icon];
            return (
              <div key={benefit.id} className="flex flex-col items-center gap-3 px-2 text-center lg:px-6">
                <Icon className="size-9 text-brand-red" aria-hidden="true" strokeWidth={1.75} />
                <h3 className="font-display text-base font-semibold text-brand-charcoal">
                  {benefit.title}
                </h3>
                <p className="whitespace-pre-line text-xs text-brand-charcoal/70 sm:text-sm">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
