// Product.material and Product.color (packages/database/prisma/schema.prisma)
// are free-text fields filled in ad hoc per product during catalog entry —
// there is no enum/controlled vocabulary at the database level. A direct
// "group by raw string" filter is unusable: as of the 2026-11 catalog there
// are 74 distinct material strings and 207 distinct color strings, many of
// them near-duplicates ("Leather gel" / "Leather-Gel" / " Leather Gel"),
// multi-value ("Industrial Wood, Faux Marble Top Table, Velvet Chairs"), or
// not actually a material/color at all (a few rows have dimensions like
// '117.5" x 117.5" x 39" H' mistakenly entered in the material field).
//
// classifyMaterial/classifyColor bucket the raw value into a small, fixed set
// of recognizable families by keyword match, so the storefront filter sidebar
// has a short, clean option list instead of exposing the raw mess. A product
// whose raw value matches no known keyword (or has none set) is simply
// omitted from these filters, not force-fit into a misleading bucket.

const MATERIAL_FAMILIES = [
  { key: "leather", label: "Leather", keywords: ["leather", "top grain", " pu", "pu ", "pu\"", "vinyl"] },
  { key: "velvet", label: "Velvet", keywords: ["velvet"] },
  { key: "fabric", label: "Fabric & Upholstered", keywords: ["fabric", "chenille", "boucle", "linen", "polyester", "cord", "suede", "teddy", "fur"] },
  { key: "wood", label: "Wood", keywords: ["wood", "oak", "pine", "walnut", "rubberwood", "maple"] },
  { key: "metal", label: "Metal", keywords: ["metal", "steel", "iron", "alloy"] },
  { key: "glass", label: "Glass & Marble", keywords: ["glass", "marble", "mirror", "granite", "quartz"] },
];

// Dimension strings ("40\" W x 43\" D x 41\" H") and bare numeric/size tokens
// occasionally land in this field by data-entry error — recognize and reject
// them rather than let them fall through to "Other".
const DIMENSION_PATTERN = /\d+(\.\d+)?\s*["”]?\s*[wWdDhH]\b/;

export function classifyMaterial(rawMaterial) {
  if (!rawMaterial || DIMENSION_PATTERN.test(rawMaterial)) return null;
  const lower = rawMaterial.trim().toLowerCase();
  if (lower === "pu") return "leather";
  for (const family of MATERIAL_FAMILIES) {
    if (family.keywords.some((kw) => lower.includes(kw))) return family.key;
  }
  return null;
}

export function materialFamilyLabel(key) {
  return MATERIAL_FAMILIES.find((f) => f.key === key)?.label ?? key;
}

export const MATERIAL_FAMILY_ORDER = MATERIAL_FAMILIES.map((f) => f.key);

// Color families map a wide range of descriptive/marketing color names (seen
// in the real catalog: "Espresso", "Mocha", "Cognac", "Greige", "Driftwood",
// "Carbon", "Gunmetal", etc.) onto a short list a shopper can actually filter
// by, each with a representative swatch hex for the UI. Ordered roughly
// light-to-dark/neutral-to-bold to match how reference sites lay out swatches.
const COLOR_FAMILIES = [
  { key: "white", label: "White", swatch: "#f5f3ee", keywords: ["white", "ivory", "pearl", "oyster", "bone", "parchment"] },
  { key: "beige", label: "Beige / Tan", swatch: "#d9c7a8", keywords: ["beige", "tan", "sand", "cream", "oatmeal", "khaki", "camel", "taupe", "stone", "greige", "biscotti", "latte", "natural", "hemp", "butternut"] },
  { key: "gray", label: "Gray", swatch: "#9a9a96", keywords: ["gray", "grey", "charcoal", "graphite", "slate", "gunmetal", "pewter", "ash", "smoke", "silver", "carbon", "steel", "iron", "alloy", "dove", "quartz"] },
  { key: "brown", label: "Brown", swatch: "#6b4a34", keywords: ["brown", "espresso", "mocha", "chocolate", "cognac", "walnut", "coffee", "caramel", "saddle", "umber", "nutmeg", "driftwood", "cappuccino", "pecan", "truffle", "sienna", "ginger", "rustic", "oak", "spice", "fossil", "bittersweet", "mustard", "cafe"] },
  { key: "black", label: "Black", swatch: "#1a1a1a", keywords: ["black", "onyx", "ebony", "midnight", "ink ", "java"] },
  { key: "blue", label: "Blue", swatch: "#3b5c82", keywords: ["blue", "navy", "indigo", "denim"] },
  { key: "green", label: "Green", swatch: "#4f6b4a", keywords: ["green", "olive", "sage"] },
  { key: "gold", label: "Gold / Brass", swatch: "#c9a24b", keywords: ["gold", "brass", "bronze"] },
  { key: "red", label: "Red / Pink", swatch: "#a84444", keywords: ["red", "pink"] },
];

export function classifyColor(rawColor) {
  if (!rawColor) return null;
  const lower = rawColor.toLowerCase();
  for (const family of COLOR_FAMILIES) {
    if (family.keywords.some((kw) => lower.includes(kw))) return family.key;
  }
  return null;
}

export function colorFamilyMeta(key) {
  return COLOR_FAMILIES.find((f) => f.key === key) ?? null;
}

export const COLOR_FAMILY_ORDER = COLOR_FAMILIES.map((f) => f.key);
