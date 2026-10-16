import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

// Natural dimensions from each source file — same oval-badge treatment as
// ShowroomSection's feature icons (fixed height, width scales to the real
// aspect ratio instead of being squashed into a square).
const categories = [
  { name: "Sofas", slug: "sofas", icon: "/sofa_icon.png", width: 441, height: 256 },
  { name: "Sectionals", slug: "sectionals", icon: "/sectionals_icon.png", width: 422, height: 239 },
  { name: "Recliners", slug: "recliners", icon: "/recliners_icon.png", width: 428, height: 264 },
  { name: "Beds", slug: "bedroom", icon: "/beds_icon.png", width: 427, height: 250 },
  { name: "Mattresses", slug: "mattresses", icon: "/mattresses_icon.png", width: 434, height: 246 },
  { name: "Dining Sets", slug: "dining", icon: "/dining_set_icon.png", width: 441, height: 251 },
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
          />
        </div>

        <div className="flex w-full flex-col items-center gap-5 text-center text-white md:w-[42%] md:shrink-0 md:items-start md:text-left lg:w-[38%]">
          <h2 className="font-serif-heading text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
            Comfort for
            <br />
            Every Room.
          </h2>

          <p className="max-w-sm text-sm text-white/75 sm:text-base">
            Shop our most popular categories and find your perfect fit, backed by great prices every day.
          </p>

          <ul className="flex w-full flex-col gap-3">
            {categories.map(({ name, slug, icon, width, height }) => (
              <li key={slug} className="flex items-center gap-3">
                <Image src={icon} alt="" width={width} height={height} className="h-9 w-auto shrink-0 sm:h-10" />
                <span className="text-sm font-bold text-white sm:text-base">{name}</span>
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
