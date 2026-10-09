import { ArrowRight } from "lucide-react";
import { financingProviders } from "@/lib/mock-data/site-config";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import BearMascot from "@/components/ui/BearMascot";

export default function FinancingBanner() {
  return (
    <section className="bg-brand-charcoal py-10 sm:py-12">
      <Container className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <BearMascot className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" pose="thumbsup" />
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
          aria-label="Financing provider placeholders — pending confirmed partnerships"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {financingProviders.map((provider) => (
            <span
              key={provider}
              className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold tracking-wide text-white/60"
            >
              {provider}
            </span>
          ))}
        </div>

        <Button href="#" variant="gold" size="lg" icon={ArrowRight}>
          Learn About Financing
        </Button>
      </Container>
    </section>
  );
}
