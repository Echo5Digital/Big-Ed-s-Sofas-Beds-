// Categories are a real two-level tree (Category.parentId, see
// schema.prisma) but GET /catalog/categories (lib/api/catalog.js's
// getCategories) returns them flat — every consumer that needs the
// parent -> children shape (the shop filter, category rollup) builds it from
// that flat list via the helpers here, rather than duplicating the grouping
// logic per call site.

// Groups a flat category list into top-level categories, each with a
// `children` array (sorted by sortOrder, same as the API's own ordering).
// Categories with an unset/unknown parentId are treated as top-level.
export function buildCategoryTree(categories) {
  const byParentId = new Map();
  for (const category of categories) {
    const key = category.parentId ?? null;
    if (!byParentId.has(key)) byParentId.set(key, []);
    byParentId.get(key).push(category);
  }

  const topLevel = byParentId.get(null) ?? [];
  return topLevel.map((parent) => ({
    ...parent,
    children: byParentId.get(parent.id) ?? [],
  }));
}

// A selected top-level category should roll up every product in its
// sub-categories too (confirmed product behavior), not just products tagged
// directly to the parent itself. Expands a single category id into itself
// plus all of its direct children's ids — one level is sufficient since the
// model is only ever two levels deep (no grandchildren).
export function expandCategoryIdWithChildren(categoryId, categories) {
  const childIds = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
  return [categoryId, ...childIds];
}

// Builds the header/mobile nav and footer "Quick Links" structure from the
// live category list, replacing what used to be a hand-maintained tree in
// lib/mock-data/site-config.js — a category created in the admin
// (CategoryMultiSelect's "Add new category") now shows up here with no
// further manual edit. "About" and "Deals" aren't categories at all (no
// Category row backs them), so they're merged in at the same positions the
// old static list had them: About first, categories in seeded sortOrder,
// Deals last.
export function buildNavItems(categories) {
  const tree = buildCategoryTree(categories);
  return [
    { label: "About", href: "/about" },
    ...tree.map((parent) => ({
      label: parent.name,
      href: `/shop/${parent.slug}`,
      children: parent.children.map((child) => ({
        label: child.name,
        href: `/shop/${parent.slug}/${child.slug}`,
      })),
    })),
    { label: "Deals", href: "/deals" },
  ];
}

// Footer "Quick Links" — just the top-level categories, no children (same
// shape the old hardcoded footerQuickLinks had), plus the same trailing
// "Deals" entry.
export function buildFooterCategoryLinks(categories) {
  const tree = buildCategoryTree(categories);
  return [
    ...tree.map((parent) => ({ label: parent.name, href: `/shop/${parent.slug}` })),
    { label: "Deals", href: "/deals" },
  ];
}

// A product's own category is frequently a sub-category (e.g. "Stationary
// Sectionals"), but category-pairing intent (see lib/categoryPairings.js)
// lives at the top level ("Living Room"). Walks up one level — the model is
// only ever two levels deep, so a category with no parentId IS the top level
// already.
//
// `category` is deliberately re-resolved against the full flat `categories`
// list by id rather than trusted as-is: serializeProduct's `product.category`
// (apps/api/src/routes/catalog.routes.js) only carries {id, name, slug} — no
// `parentId` — so checking `category.parentId` directly always reads
// `undefined` and incorrectly treats every product's category as top-level
// already. `categories` (from getCategories()) is the only place parentId
// actually lives. Falls back to the category's own slug if its id somehow
// isn't in that list (e.g. stale/inconsistent data), rather than throwing.
export function topLevelCategorySlugFor(category, categories) {
  if (!category) return null;
  const fullCategory = categories.find((c) => c.id === category.id) ?? category;
  if (!fullCategory.parentId) return fullCategory.slug;
  const parent = categories.find((c) => c.id === fullCategory.parentId);
  return parent?.slug ?? fullCategory.slug;
}
