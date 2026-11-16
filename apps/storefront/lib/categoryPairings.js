// "Frequently Bought Together" (product detail page) pairs a product with
// OTHER-subcategory products chosen from a hand-curated map, not same-
// category ones — that's already covered by the "You May Also Like" section
// (same category, see app/shop/[...slug]/page.jsx's `related`). There's no
// stored "these subcategories complement each other" relationship anywhere
// in the schema (Category only has a parent/child tree, see schema.prisma),
// so this is a small hand-curated map, mirroring how lib/productAttributes.js
// hand-curates material/color families from messy source data.
//
// Keyed by SUBCATEGORY slug (not top-level) — pairing intent here is
// deliberately more specific than the old top-level-only map (e.g.
// "Stationary Sofas & Loveseats" recommends "Occasional Tables" specifically,
// not just "anything in Living Room"). Values are listed in PRIORITY order:
// the selection logic (page.jsx) walks them in order and keeps going until
// it has enough eligible products, it does not pick one-per-entry.
//
// A value can be either:
//   - a real subcategory slug (e.g. "occasional-tables") — candidates come
//     only from that one subcategory.
//   - a top-level category slug (e.g. "living-room") — candidates come from
//     ANY subcategory under that room. Used for the Home Accessories row's
//     "Living Room Furniture" entry, which has no single matching
//     subcategory in the seeded data (see seed.js's category tree) — the
///    intent there is clearly "anything living-room", not one specific item.
//
// Real subcategory slugs, from packages/database/prisma/seed.js:
//   Living Room: stationary-sofas-loveseats, stationary-sectionals,
//     reclining-sofas-loveseats, reclining-sectionals, recliners-lift-chairs,
//     sleepers-futons, occasional-tables, tv-stands
//   Bedroom: beds, bedroom-furniture, mattresses, daybeds, bunk-beds,
//     vanities-mirrors
//   Dining: dining-room-furniture, barstools
//   Office: office-bookcase
//   Accessories: home-accessories
const SUBCATEGORY_PAIRINGS = {
  // --- Living Room ---------------------------------------------------------
  "stationary-sofas-loveseats": ["occasional-tables", "home-accessories", "recliners-lift-chairs"],
  "stationary-sectionals": ["occasional-tables", "tv-stands", "home-accessories"],
  "reclining-sofas-loveseats": ["recliners-lift-chairs", "occasional-tables", "home-accessories"],
  "reclining-sectionals": ["occasional-tables", "tv-stands", "home-accessories"],
  "recliners-lift-chairs": ["stationary-sofas-loveseats", "occasional-tables", "home-accessories"],
  "sleepers-futons": ["occasional-tables", "home-accessories", "mattresses"],
  "occasional-tables": ["stationary-sofas-loveseats", "stationary-sectionals", "home-accessories"],
  "tv-stands": ["stationary-sofas-loveseats", "stationary-sectionals", "home-accessories"],

  // --- Bedroom ---------------------------------------------------------------
  beds: ["mattresses", "bedroom-furniture", "home-accessories"],
  "bedroom-furniture": ["beds", "mattresses", "vanities-mirrors"],
  mattresses: ["beds", "bedroom-furniture", "home-accessories"],
  daybeds: ["mattresses", "bedroom-furniture", "home-accessories"],
  "bunk-beds": ["mattresses", "bedroom-furniture", "home-accessories"],
  "vanities-mirrors": ["bedroom-furniture", "beds", "home-accessories"],

  // --- Dining ------------------------------------------------------------
  "dining-room-furniture": ["barstools", "home-accessories"],
  barstools: ["dining-room-furniture", "home-accessories"],

  // --- Office ------------------------------------------------------------
  "office-bookcase": ["home-accessories", "bedroom-furniture", "occasional-tables"],

  // --- Accessories ---------------------------------------------------------
  // Static fallback only — a Home Accessories product that's also tagged
  // (via the secondary ProductCategory relation) into a specific room uses
  // that room's own mapping instead; see roomAwarePairingsFor() below.
  "home-accessories": ["occasional-tables", "living-room", "bedroom-furniture", "dining-room-furniture"],
};

export function pairedSubcategorySlugsFor(subcategorySlug) {
  return SUBCATEGORY_PAIRINGS[subcategorySlug] ?? [];
}

// Home Accessories products don't have their own room — "a living-room
// accessory should suggest sofas/sectionals, a bedroom accessory should
// suggest beds" (the brief's "dynamic room-based recommendations"). The only
// per-product signal that can carry that intent today is a secondary
// category tag (Product.categoryTags / the `categories` field on the
// serialized product) pointing at one of the four room top-levels — no
// current seeded product actually has one set, so this always falls through
// to the static "home-accessories" row above until staff start tagging
// accessory products with their intended room.
const ACCESSORY_ROOM_PAIRINGS = {
  "living-room": ["stationary-sofas-loveseats", "stationary-sectionals", "recliners-lift-chairs", "occasional-tables"],
  bedroom: ["beds", "bedroom-furniture", "vanities-mirrors"],
  dining: ["dining-room-furniture", "barstools"],
  office: ["office-bookcase"],
};

// `secondaryCategorySlugs` is the product's OTHER category tags (not its
// primary subcategory) — e.g. product.categories.map(c => c.slug) from
// serializeProduct. Returns the room-specific list for the first matching
// tag found, or the static home-accessories fallback if none match.
export function roomAwarePairingsFor(subcategorySlug, secondaryCategorySlugs) {
  if (subcategorySlug === "home-accessories") {
    const roomSlug = secondaryCategorySlugs?.find((slug) => ACCESSORY_ROOM_PAIRINGS[slug]);
    if (roomSlug) return ACCESSORY_ROOM_PAIRINGS[roomSlug];
  }
  return pairedSubcategorySlugsFor(subcategorySlug);
}
