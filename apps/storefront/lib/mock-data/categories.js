// Placeholder category imagery sourced from Unsplash for demo purposes only.
// Replace with client-approved, licensed product photography before production.
//
// `group` maps each specific category to the broader nav/shop grouping
// (living-room, bedroom, mattresses, dining) so /shop/[category] can resolve
// both specific slugs (e.g. "sofas") and top-level nav slugs (e.g. "living-room").

export const categories = [
  {
    id: "sofas",
    name: "Sofas",
    slug: "sofas",
    group: "living-room",
    description:
      "Comfortable, stylish sofas built for everyday living — from classic silhouettes to modern track arms.",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "sectionals",
    name: "Sectionals",
    slug: "sectionals",
    group: "living-room",
    description:
      "Roomy sectionals designed to maximize seating and comfort for family rooms and open-concept living spaces.",
    image: "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "recliners",
    name: "Recliners",
    slug: "recliners",
    group: "living-room",
    description:
      "Kick back in a recliner built for relaxation, with smooth reclining action and plush cushioning.",
    image: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "bedroom-sets",
    name: "Bedroom Sets",
    slug: "bedroom-sets",
    group: "bedroom",
    description:
      "Complete bedroom sets that pair a bed frame with matching dressers and nightstands for a coordinated look.",
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "beds",
    name: "Beds",
    slug: "beds",
    group: "bedroom",
    description:
      "Standalone bed frames in a range of styles, from upholstered headboards to clean platform designs.",
    image: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "mattresses",
    name: "Mattresses",
    slug: "mattresses",
    group: "mattresses",
    description:
      "Supportive mattresses from trusted brands, including memory foam, hybrid, and traditional innerspring builds.",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=450&fit=crop&q=80",
  },
  {
    id: "dining-sets",
    name: "Dining Sets",
    slug: "dining-sets",
    group: "dining",
    description:
      "Dining sets sized for everyday meals and holiday gatherings alike, with tables, chairs, and benches that match.",
    image: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&h=450&fit=crop&q=80",
  },
];

// Top-level shop groupings surfaced in the main nav. Each maps to one or more
// categories above via the `group` field on each category.
export const shopGroups = [
  {
    slug: "living-room",
    name: "Living Room",
    description:
      "Sofas, sectionals and recliners built for the room where everyone gathers. Find your next favorite seat.",
  },
  {
    slug: "bedroom",
    name: "Bedroom",
    description:
      "Beds and bedroom sets that turn any room into a restful retreat, from headboards to matching nightstands.",
  },
  {
    slug: "mattresses",
    name: "Mattresses",
    description:
      "Quality mattresses for every sleep style, backed by in-store comfort testing and flexible financing.",
  },
  {
    slug: "dining",
    name: "Dining",
    description:
      "Dining tables and chairs for weeknight dinners and holiday hosting, sized to fit real rooms.",
  },
];
