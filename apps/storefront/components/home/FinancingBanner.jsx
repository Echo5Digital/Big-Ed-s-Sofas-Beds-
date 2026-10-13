import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { financingProviders } from "@/lib/mock-data/site-config";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

export default function FinancingBanner() {
  return (
    <section className="bg-brand-charcoal py-10 sm:py-12">
      <Container className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/images/mascot/big-ed-thumbsup.webp"
            alt="Big Ed mascot giving a thumbs up"
            width={1583}
            height={992}
            className="h-20 w-auto shrink-0 self-start sm:h-24"
          />
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand-gold sm:text-3xl">
              Comfort Today.
              <br />
              Pay Your Way.
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Flexible financing options to fit your budget.
            </p>
          </div>
        </div>

        <div
          aria-label="Financing provider logos — partnerships pending confirmation"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {financingProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex h-12 w-28 items-center justify-center rounded-md bg-white px-3 sm:w-32"
            >
              <Image
                src={provider.logo}
                alt={provider.name}
                width={160}
                height={60}
                className="h-full w-full object-contain"
              />
            </div>
          ))}
        </div>

        <Button href="/financing" variant="gold" size="lg" icon={ArrowRight}>
          Learn About Financing
        </Button>
      </Container>
    </section>
  );
}
