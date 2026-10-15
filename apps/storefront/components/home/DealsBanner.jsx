import Image from "next/image";
import { Check, ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

const categories = ["Sofas", "Sectionals", "Recliners", "Beds", "Mattresses", "Dining Sets"];

export default function DealsBanner() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand-red-dark via-brand-red to-black py-10 sm:py-14">
      <Container className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-10 lg:gap-16">
        <div className="relative aspect-4/3 w-full shrink-0 sm:aspect-video md:aspect-2120/742 md:w-1/2">
          <Image
            src="/UnBEARably Good Deals Mascot Banner.webp"
            alt="UnBEARably Good Deals! Big Ed mascot giving a thumbs up"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain object-center md:object-left"
            priority
          />
        </div>

        <div className="flex w-full flex-col items-center gap-4 text-center text-white md:w-1/2 md:items-start md:gap-5 md:text-left">
          <h2 className="font-display text-2xl leading-tight font-semibold sm:text-3xl">
            Comfort for
            <br />
            Every Room.
          </h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-semibold sm:grid-cols-3 md:flex md:flex-col md:gap-2.5">
            {categories.map((item) => (
              <li key={item} className="flex items-center justify-center gap-1.5 md:justify-start">
                <Check className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <Button href="/deals" variant="gold" size="lg" icon={ArrowRight} className="mt-1">
            Shop Deals
          </Button>
        </div>
      </Container>
    </section>
  );
}
