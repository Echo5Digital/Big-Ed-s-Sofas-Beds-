import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sofa, Grid3x3, Armchair, BedDouble, Bed, UtensilsCrossed } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

const categories = [
  { name: "Sofas", slug: "sofas", icon: Sofa, color: "bg-brand-red" },
  { name: "Sectionals", slug: "sectionals", icon: Grid3x3, color: "bg-blue-600" },
  { name: "Recliners", slug: "recliners", icon: Armchair, color: "bg-green-600" },
  { name: "Beds", slug: "bedroom", icon: BedDouble, color: "bg-purple-600" },
  { name: "Mattresses", slug: "mattresses", icon: Bed, color: "bg-orange-500" },
  { name: "Dining Sets", slug: "dining", icon: UtensilsCrossed, color: "bg-teal-600" },
];

export default function DealsBanner() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand-red-dark via-brand-red to-black py-10 sm:py-14">
      <Container className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-10 lg:gap-16">
        <div className="relative aspect-1773/886 w-full shrink-0 md:-my-6 md:w-[58%] lg:-my-10 lg:w-[62%]">
          <Image
            src="/unbearably_good_deals.webp"
            alt="UnBEARably Good Deals! Big Ed mascot giving a thumbs up in a recliner"
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-contain object-center"
            priority
          />
        </div>

        <div className="flex w-full flex-col items-center gap-5 text-center text-white md:w-[42%] md:shrink-0 md:items-start md:text-left lg:w-[38%]">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-bold tracking-wide text-brand-gold uppercase ring-1 ring-brand-gold/40">
            Storewide Savings
          </span>

          <h2 className="font-serif-heading text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
            Comfort for
            <br />
            Every Room.
          </h2>

          <p className="max-w-sm text-sm text-white/75 sm:text-base">
            Shop our most popular categories and find your perfect fit, backed by great prices every day.
          </p>

          <ul className="grid w-full grid-cols-2 gap-3 sm:gap-4">
            {categories.map(({ name, slug, icon: Icon, color }) => (
              <li key={slug}>
                <Link
                  href={`/shop/${slug}`}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold sm:px-4 sm:py-3"
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-white sm:size-10 ${color}`}>
                    <Icon className="size-4.5 shrink-0 sm:size-5" aria-hidden="true" />
                  </span>
                  <span className="flex flex-1 items-center justify-between gap-1 text-sm font-bold text-brand-charcoal sm:text-base">
                    {name}
                    <ArrowRight className="size-4 shrink-0 text-brand-charcoal/50" aria-hidden="true" />
                  </span>
                </Link>
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
