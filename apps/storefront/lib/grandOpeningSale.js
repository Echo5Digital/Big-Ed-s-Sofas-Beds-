import { cacheLife } from "next/cache";
import { parseInlineMarkdown } from "@big-eds/ui";
import { getAllProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";

// Products for the /grand-opening-sale page: the most attractive deals from the
// "Beds" (/shop/beds) and "Bedroom Furniture" (/shop/bedroom-furniture)
// categories, at most MAX_PRODUCTS combined. Chosen live from the catalog, so
// the page keeps itself current as prices, stock and products change.
export const SALE_CATEGORIES = ["beds", "bedroom-furniture"];
export const MAX_PRODUCTS = 10;
const PER_CATEGORY = MAX_PRODUCTS / SALE_CATEGORIES.length;

// "Attractive" = something a shopper would want to look at and can actually buy:
//  - active, in stock, with a real markdown (compare-at price above the price);
//  - well photographed (several images — thin listings look weak in a grid);
//  - a bed or a full bedroom set, not a single accessory or a kids'/space-saver
//    piece (chest, nightstand, dresser, mirror, bunk, trundle, ...);
//  - one product per collection, so five colourways of one bed don't fill the page.
// Within each category the biggest savings win, then the best-photographed.
const MIN_IMAGES = 3;
const EXCLUDED_NAME = /\b(chest|nightstand|night stand|dresser|mirror|bench|mattress|armoire|vanity|desk|trundle|bunk|loft|twin|crib)\b/i;

// Marketing tags the catalog writes in bold inside product names — they belong
// on a badge, not in the card title.
const PROMO_TAG = /new arrival|premium quality/i;

// A size list ("Queen, King", "Full, Queen"), as opposed to a product description.
const SIZE_LIST = /^(queen|king|full|twin|california|cal\b)/i;

// "Nico White Platform - Queen, King Bed" -> title "Nico White Platform",
// subtitle "Queen, King Bed". Names without a " - " stay whole. When the first
// part is only a short model name or code ("B948 - 5pc Bedroom Set - Queen,
// King"), the product description joins it, so the card reads "B948 5pc
// Bedroom Set" over "Queen, King" instead of a bare "B948".
export function splitProductName(name) {
  const plain = parseInlineMarkdown(name)
    .map((segment) => (segment.bold && PROMO_TAG.test(segment.text) ? "" : segment.text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  let [title, ...rest] = plain.split(/\s*[-–—]\s+/);
  if (rest.length > 0 && title.split(" ").length <= 2 && !SIZE_LIST.test(rest[0])) {
    title = `${title} ${rest.shift()}`;
  }
  return { title: title || plain, subtitle: rest.join(" - ") };
}

function rankedCandidates(rawProducts) {
  const bestPerCollection = new Map();

  for (const product of rawProducts) {
    if (product.status !== "ACTIVE" || (product.images?.length ?? 0) < MIN_IMAGES) continue;
    if (EXCLUDED_NAME.test(product.name)) continue;

    const card = normalizeProductForCard(product);
    const saving = card.compareAtPrice && card.compareAtPrice > card.price ? 1 - card.price / card.compareAtPrice : 0;
    if (!card.image || !(card.price > 0) || card.totalAvailable <= 0 || saving <= 0) continue;

    const entry = { product, card, saving };
    const key = (product.itemName || product.name).trim().toLowerCase();
    const current = bestPerCollection.get(key);
    if (
      !current ||
      saving > current.saving ||
      (saving === current.saving && product.images.length > current.product.images.length)
    ) {
      bestPerCollection.set(key, entry);
    }
  }

  return [...bestPerCollection.values()].sort(
    (a, b) => b.saving - a.saving || b.product.images.length - a.product.images.length || a.card.slug.localeCompare(b.card.slug)
  );
}

// If the API is unreachable this throws (errors aren't cached), the same way
// the rest of the homepage data does, rather than caching an empty page.
export async function getGrandOpeningProducts() {
  "use cache";
  cacheLife("minutes");

  const perCategory = await Promise.all(
    SALE_CATEGORIES.map(async (category) => rankedCandidates((await getAllProducts({ category, sort: "oldest" })).products))
  );

  const chosen = [];
  const seen = new Set();
  const take = (candidates, limit) => {
    for (const entry of candidates) {
      if (limit <= 0) break;
      if (seen.has(entry.card.id)) continue; // a product tagged in both categories counts once
      seen.add(entry.card.id);
      chosen.push(entry);
      limit -= 1;
    }
  };

  perCategory.forEach((candidates) => take(candidates, PER_CATEGORY));
  // If one category had fewer than its share, fill the remaining slots from the others.
  perCategory.forEach((candidates) => take(candidates, MAX_PRODUCTS - chosen.length));

  return chosen.map(({ product, card }) => ({
    id: card.id,
    slug: card.slug,
    ...splitProductName(product.name),
    image: card.image,
    price: card.price,
    compareAtPrice: card.compareAtPrice,
    fit: "cover",
    position: "center",
  }));
}
