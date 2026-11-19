import { Sofa } from "lucide-react";
import DealCard from "@/components/home/DealCard";
import SpecialsHeader from "@/components/sale/SpecialsHeader";
import ImageCarousel from "@/components/sale/ImageCarousel";

// Grand-opening living room flyer set — plain decorative images shown above
// the real shoppable grid below (see ImageCarousel). caption/subcaption match
// what's actually printed on each flyer (collection name + the piece shown).
const LIVING_ROOM_FLYER_CAPTIONS = [
  { caption: "Accent Collection", subcaption: "Power lift recliner.", priceLabel: "Door Buster", price: "$349.99" },
  { caption: "Ela Collection", subcaption: "Reversible sectional with pullout bed & storage chaise.", priceLabel: "2pc Set", price: "$489.99" },
  { caption: "Blush Collection", subcaption: "Pink velvet reversible sectional with matching ottoman.", priceLabel: "2pc Set", price: "$529.99" },
  { caption: "Phyll Collection", subcaption: "Reclining sofa & loveseat with cup holders.", priceLabel: "Chair / 2pc Set", price: "$309.99 / $1,189.99" },
];
const LIVING_ROOM_FLYER_IMAGES = [1, 2, 3, 4].map((n, i) => ({
  src: `/BIGEDS SOFAS & BEDS S${n}.webp`,
  alt: `Big Ed's Sofas & Beds living room grand opening flyer ${n}`,
  ...LIVING_ROOM_FLYER_CAPTIONS[i],
}));

// The "Living Room Specials" block: same header bar and card grid as Bedroom
// Specials, shown right below it inside the same page section (see
// SaleProducts.jsx).
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
        tagline="Sofas, sectionals & recliners at grand opening prices"
      />

      <div className="mt-8 sm:mt-10">
        <ImageCarousel images={LIVING_ROOM_FLYER_IMAGES} />
      </div>

      <ul className="relative z-10 mt-10 flex [--cols:2] [--gap:0.75rem] flex-wrap justify-center gap-(--gap) sm:mt-12 sm:[--cols:3] sm:[--gap:1rem] lg:[--cols:4] lg:[--gap:1.25rem] xl:[--cols:5]">
        {products.map((product) => (
          <DealCard key={product.slug} deal={product} size="compact" />
        ))}
      </ul>
    </section>
  );
}
