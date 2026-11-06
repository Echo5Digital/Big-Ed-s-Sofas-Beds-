import Image from "next/image";
import Link from "next/link";
import DealsCarousel from "@/components/home/DealsCarousel";
import Container from "@/components/ui/Container";
import { normalizeProductForCard } from "@/lib/api/normalize";

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

// deals is the already-shuffled, raw-API-shape product list the homepage
// fetched (see app/page.jsx) — normalized here, same convention
// FeaturedProducts.jsx follows for its own raw product list.
export default function DealsBanner({ deals: rawDeals }) {
  const deals = rawDeals.map(normalizeProductForCard);

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand-red-dark via-brand-red to-black py-10 sm:py-14">
      <Container className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-8 xl:gap-12">
        <div className="flex w-full flex-col items-center gap-6 lg:w-[54%] lg:shrink-0 xl:w-[52%]">
          <div className="relative aspect-1773/886 w-full md:-mb-4 lg:-mb-6">
            <Image
              src="/unbearably_good_deals.webp"
              alt="UnBEARably Good Deals! Big Ed mascot giving a thumbs up in a recliner"
              fill
              sizes="(max-width: 1024px) 100vw, 54vw"
              className="object-contain object-center"
            />
          </div>

          <ul className="grid w-full grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
            {categories.map(({ name, slug, icon, width, height }) => (
              <li key={slug}>
                <Link
                  href={`/shop/${slug}`}
                  className="flex flex-col items-center gap-1.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                >
                  <Image src={icon} alt="" width={width} height={height} className="h-11 w-auto sm:h-12" />
                  <span className="text-xs font-bold text-white sm:text-sm">{name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full lg:w-[46%] xl:w-[48%]">
          <DealsCarousel products={deals} />
        </div>
      </Container>
    </section>
  );
}
