import { Check, ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import BearMascot from "@/components/ui/BearMascot";

const categories = ["Sofas", "Sectionals", "Recliners", "Beds", "Mattresses", "Dining Sets"];

export default function DealsBanner() {
  return (
    <section className="bg-gradient-to-r from-brand-red-dark via-brand-red to-brand-red-dark py-10 sm:py-12">
      <Container className="flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <BearMascot className="h-28 w-28 shrink-0 drop-shadow-xl sm:h-32 sm:w-32" pose="thumbsup" />
          <h2 className="font-display text-stroke-dark text-3xl font-bold leading-[1.05] text-brand-gold drop-shadow-[0_3px_0_rgba(0,0,0,0.3)] sm:text-4xl">
            UnBEARably
            <br />
            Good Deals!
          </h2>
        </div>

        <div className="flex flex-col items-start gap-4 text-white">
          <h3 className="font-display text-2xl font-semibold sm:text-3xl">Comfort for Every Room.</h3>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-semibold sm:grid-cols-3">
            {categories.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <Button href="#" variant="gold" size="lg" icon={ArrowRight}>
            Shop All Deals
          </Button>
        </div>
      </Container>
    </section>
  );
}
