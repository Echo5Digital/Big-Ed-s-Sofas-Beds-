// Shared helpers for resolving shop/category pages from mock data.
// Centralized here so the dynamic [category] route, the Deals page, and any
// other shop-adjacent page can resolve products the same way.

import { categories, shopGroups } from "@/lib/mock-data/categories";
import { products } from "@/lib/mock-data/products";

// Resolves a /shop/[category] slug to a descriptive heading + product list.
// Supports both specific category slugs (e.g. "sofas") and top-level nav
// group slugs (e.g. "living-room") so every nav/footer link resolves to a
// real page with real products.
export function resolveShopSlug(slug) {
  const group = shopGroups.find((g) => g.slug === slug);
  if (group) {
    const groupCategories = categories.filter((c) => c.group === group.slug);
    const categorySlugs = groupCategories.map((c) => c.slug);
    const groupProducts = products.filter((p) => categorySlugs.includes(p.category));
    return {
      name: group.name,
      slug: group.slug,
      description: group.description,
      products: groupProducts,
      subCategories: groupCategories,
    };
  }

  const category = categories.find((c) => c.slug === slug);
  if (category) {
    const categoryProducts = products.filter((p) => p.category === category.slug);
    return {
      name: category.name,
      slug: category.slug,
      description: category.description,
      products: categoryProducts,
      subCategories: [],
    };
  }

  return null;
}

export function getDealsProducts() {
  return products.filter((p) => Boolean(p.compareAtPrice));
}

export function getRelatedProducts(product, limit = 4) {
  return products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, limit);
}

export function getAllShopSlugs() {
  return [...shopGroups.map((g) => g.slug), ...categories.map((c) => c.slug)];
}
