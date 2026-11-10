import { cacheLife } from "next/cache";
import { getProductBySlug } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

// Hand-picked products for the homepage "Featured Doorbuster Deals" section
// (components/home/DoorbusterDeals.jsx). Only the editorial bits live here —
// which products, the short title/subtitle shown on the card, and how the
// photo is framed. Price, compare-at price, photo and stock always come live
// from the catalog API, so the section can never show a stale price.
//
//   fit      "cover" fills the frame (lifestyle photos); "contain" shows the
//            whole picture (product-on-white shots that would otherwise crop).
//   position CSS object-position — keeps the subject in frame when cropping.
//   zoom     optional scale for photos where the product sits small in frame.
export const DOORBUSTER_ITEMS = [
  {
    slug: "nico-white-platform-queen-king-bed",
    title: "Nico White",
    subtitle: "Platform Bed · Queen & King",
    fit: "cover",
    position: "center 62%",
  },
  {
    slug: "romance2-blue-platform-bed-queen-king",
    title: "Romance2 Blue",
    subtitle: "Platform Bed · Queen & King",
    fit: "cover",
    position: "center 55%",
  },
  {
    slug: "washington-3006-navy-sectional-new-arrival",
    title: "Washington 3006",
    subtitle: "Navy Sectional",
    fit: "cover",
    position: "center 60%",
  },
  {
    slug: "venetian-4pc-or-5pc-platform-bedroom-set-queen-king",
    title: "Venetian",
    subtitle: "4pc or 5pc Bedroom Set",
    fit: "cover",
    position: "center 60%",
  },
  {
    slug: "washington-9015-indigo-rocker-recliner-new-arrival",
    title: "Washington 9015",
    subtitle: "Indigo Rocker Recliner",
    fit: "cover",
    position: "center 42%",
  },
  {
    slug: "d1020-dining-table-6-chair-set",
    title: "D1020 Dining",
    subtitle: "Table + 6 Chair Set",
    fit: "cover",
    position: "center 62%",
  },
  {
    slug: "m125-nectar-memory-foam-firm-queen-king",
    title: "Nectar M125",
    subtitle: "Firm Memory Foam Mattress",
    fit: "contain",
    position: "center",
    zoom: 1.1,
  },
];

// A missing slug (archived/renamed product) just drops that card. But if every
// request fails for a reason other than "not found" (API down), throw instead
// of returning an empty list — errors aren't cached, so the section comes back
// as soon as the API does, and it fails the same way the rest of the homepage
// does when the API is unreachable.
export async function getDoorbusterDeals() {
  "use cache";
  cacheLife("minutes");

  let failures = 0;
  let firstError = null;

  const cards = await Promise.all(
    DOORBUSTER_ITEMS.map(async (item) => {
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
        ...item,
        id: card.id,
        image: card.image,
        price: card.price,
        compareAtPrice: card.compareAtPrice,
      };
    })
  );

  if (failures === DOORBUSTER_ITEMS.length) throw firstError;
  return cards.filter(Boolean);
}
