// Adapts live API catalog data (multi-variant, integer-cents) into the flat,
// dollar-based shape the existing presentational components (ProductCard,
// Price, the product detail page) were built against for the mock data, so
// those components don't need to change. Uses the product's first active
// variant as the "representative" variant for list/card display — the
// product detail page offers a full variant selector.
export function normalizeProductForCard(product) {
  const variant = product.variants?.find((v) => v.isActive) ?? product.variants?.[0];
  const totalAvailable = variant?.availability?.totalAvailable ?? 0;

  return {
    id: product.id,
    variantId: variant?.id ?? null,
    slug: product.slug,
    name: product.name,
    image: product.images?.[0]?.url ?? null,
    price: variant ? variant.priceCents / 100 : 0,
    compareAtPrice: variant?.compareAtCents ? variant.compareAtCents / 100 : null,
    category: product.category?.slug ?? null,
    // Every category id this product belongs to — its primary category plus
    // any secondary ProductCategory tags (see schema.prisma) — used by the
    // shop filter's category matching (components/shop/ProductGridWithControls.jsx),
    // which needs ids (to check against a selected category's sub-category
    // ids) rather than just the single primary slug above.
    categoryIds: [
      ...(product.category ? [product.category.id] : []),
      ...(product.categories ?? []).map((c) => c.id),
    ],
    createdAt: product.createdAt ?? null,
    isDeal: product.isDeal ?? false,
    badge: totalAvailable <= 0 ? "OUT OF STOCK" : null,
    totalAvailable,
    rating: null,
    reviewCount: null,
    // Raw Product.material/color — free text, not guaranteed set. See
    // lib/productAttributes.js for how the storefront buckets these into a
    // filterable set of families despite inconsistent source data.
    material: product.material ?? null,
    color: product.color ?? null,
  };
}
