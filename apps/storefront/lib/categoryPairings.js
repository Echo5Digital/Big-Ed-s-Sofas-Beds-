// "Frequently Bought Together" (product detail page) deliberately pairs a
// product with OTHER-category products, not same-category ones — that's
// already covered by the "You May Also Like" section (same category, see
// app/products/[slug]/page.jsx's `related`). There's no stored "these
// categories complement each other" relationship anywhere in the schema
// (Category only has a parent/child tree, see schema.prisma), so this is a
// small hand-curated map of top-level category slug -> other top-level
// category slugs it commonly pairs with in a furniture store, mirroring how
// lib/productAttributes.js hand-curates material/color families from messy
// source data. Keyed by TOP-LEVEL category slug — a sub-category product
// (e.g. "stationary-sectionals") is looked up via its parent's slug, since
// pairing intent lives at the room/department level, not the sub-category
// level (seed.js's real top-level categories: living-room, bedroom, dining,
// office, accessories).
const CATEGORY_PAIRINGS = {
  "living-room": ["accessories", "dining"],
  bedroom: ["accessories"],
  dining: ["accessories", "living-room"],
  office: ["accessories"],
  // Accessories complement every room, so they pair with all of the above —
  // listed explicitly (not derived) so this file stays the single readable
  // source of truth rather than needing the reader to infer symmetry.
  accessories: ["living-room", "bedroom", "dining", "office"],
};

export function pairedCategorySlugsFor(topLevelCategorySlug) {
  return CATEGORY_PAIRINGS[topLevelCategorySlug] ?? [];
}
