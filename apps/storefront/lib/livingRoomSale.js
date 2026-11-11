import { cacheLife } from "next/cache";
import { getProductBySlug } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

// Hand-picked products for the "Living Room Specials" section of the
// /grand-opening-sale page (components/sale/LivingRoomSpecials.jsx). Same idea
// as lib/doorbusterDeals.js: only the editorial bits live here — which
// products and the short title/subtitle on the card. Price, compare-at price,
// photo and stock always come live from the catalog API, so the section can
// never show a stale price.
//
// The first three were requested by name; the rest are in-stock, marked-down
// seating (sets, sectionals, recliners) chosen to give the section some range.
export const LIVING_ROOM_ITEMS = [
  {
    slug: "spain-black-power-reclining-sectional-power-headrests",
    title: "Spain Black",
    subtitle: "Power Reclining Sectional",
  },
  {
    slug: "aria-charcoal-sectional-with-pull-out-bed-storage-chaise",
    title: "Aria Charcoal",
    subtitle: "Sectional · Pull-Out Bed & Chaise",
  },
  {
    slug: "washington-9010-chocolate-rocker-recliner-new-arrival",
    title: "Washington 9010",
    subtitle: "Chocolate Rocker Recliner",
  },
  {
    slug: "aiden-gray-3pc-reclining-set",
    title: "Aiden Gray",
    subtitle: "3pc Reclining Set",
  },
  {
    slug: "behold-1001-charcoal-sofa-loveseat-set-oversized-new-arrival",
    title: "Behold 1001 Charcoal",
    subtitle: "Oversized Sofa & Loveseat",
  },
  {
    slug: "9900-gray-4pc-oversized-sectional-new-arrival",
    title: "9900 Gray",
    subtitle: "4pc Oversized Sectional",
  },
  {
    slug: "ace-white-3pc-reclining-set",
    title: "Ace White",
    subtitle: "3pc Reclining Set",
  },
  {
    slug: "topgun2-ivory-power-recliner-bluetooth-speaker-led-light",
    title: "TopGun2 Ivory",
    subtitle: "Power Recliner · Speaker & LED",
  },
  {
    slug: "albert30-3pc-reclining-set",
    title: "Albert30",
    subtitle: "3pc Reclining Set",
  },
  {
    slug: "ashley-292-04-sofa-loveseat",
    title: "Ashley 292-04",
    subtitle: "Sofa & Loveseat",
  },
];

// A missing slug (archived/renamed product) or one that is out of stock just
// drops that card. If every request fails for a reason other than "not found"
// (API down), throw instead of returning an empty list — errors aren't cached,
// so the section comes back as soon as the API does, and it fails the same way
// the rest of the page does when the API is unreachable.
export async function getLivingRoomProducts() {
  "use cache";
  cacheLife("minutes");

  let failures = 0;
  let firstError = null;

  const cards = await Promise.all(
    LIVING_ROOM_ITEMS.map(async (item) => {
      let product;
      try {
        product = await getProductBySlug(item.slug);
      } catch (error) {
        if (error?.status !== 404) {
          failures += 1;
          firstError ??= error;
        }
        return null;
      }

      const card = normalizeProductForCard(product);
      const sellable = product.status === "ACTIVE" && card.image && card.price > 0 && card.totalAvailable > 0;
      if (!sellable) return null;

      return {
        id: card.id,
        slug: card.slug,
        title: item.title,
        subtitle: item.subtitle,
        image: card.image,
        price: card.price,
        compareAtPrice: card.compareAtPrice,
        fit: "cover",
        position: item.position ?? "center",
      };
    })
  );

  if (failures === LIVING_ROOM_ITEMS.length) throw firstError;
  return cards.filter(Boolean);
}
