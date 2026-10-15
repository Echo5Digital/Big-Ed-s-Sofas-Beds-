import Image from "next/image";
import { Check, ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

const categories = ["Sofas", "Sectionals", "Recliners", "Beds", "Mattresses", "Dining Sets"];

export default function DealsBanner() {
  return (
    <section className="bg-brand-cream py-8 sm:py-10">
      <Container>
        <div className="flex flex-col items-center overflow-hidden rounded-3xl bg-linear-to-br from-brand-red-dark via-brand-red to-black shadow-lg md:flex-row">
          <div className="relative aspect-4/3 w-full shrink-0 sm:aspect-video md:aspect-2120/742 md:w-[55%] lg:w-1/2">
            <Image
              src="/UnBEARably Good Deals Mascot Banner.webp"
              alt="UnBEARably Good Deals! Big Ed mascot giving a thumbs up"
              fill
              sizes="(max-width: 768px) 100vw, 55vw"
              className="object-contain object-center md:object-left"
              priority
            />
          </div>

          <div className="flex w-full flex-col items-center gap-4 px-6 pb-8 text-center text-white md:w-[45%] md:items-start md:gap-5 md:px-4 md:py-10 md:pr-10 md:text-left lg:w-1/2">
            <h2 className="font-display text-2xl leading-tight font-semibold sm:text-3xl">
              Comfort for
              <br />
              Every Room.
            </h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-semibold sm:grid-cols-3 md:flex md:flex-col md:gap-2.5">
              {categories.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Button href="/deals" variant="gold" size="lg" icon={ArrowRight} className="mt-1">
              Shop Deals
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
