import { Sofa } from "lucide-react";
import DealCard from "@/components/home/DealCard";
import SpecialsHeader from "@/components/sale/SpecialsHeader";

// The "Living Room Specials" block: same header bar and card grid as Bedroom
// Specials, shown right below it inside the same page section (see
// SaleProducts.jsx). Its flyers are in the top strip (PromoMarquee.jsx).
//
// products: the already-chosen list from getLivingRoomProducts()
// (lib/livingRoomSale.js).
export default function LivingRoomSpecials({ products }) {
  if (!products.length) return null;

  return (
    <section aria-labelledby="living-room-heading" className="mt-14 sm:mt-20">
      <SpecialsHeader
        id="living-room-heading"
        icon={Sofa}
        title="Living Room Specials"
        count={products.length}
        tagline="Sofas, Sectionals & Recliners at Grand Opening Prices!"
      />

      <ul className="relative z-10 mt-12 flex [--cols:2] [--gap:0.75rem] flex-wrap justify-center gap-(--gap) sm:[--cols:3] sm:[--gap:1rem] lg:[--cols:4] lg:[--gap:1.25rem] xl:[--cols:5]">
        {products.map((product) => (
          <DealCard key={product.slug} deal={product} size="compact" />
        ))}
      </ul>
    </section>
  );
}
