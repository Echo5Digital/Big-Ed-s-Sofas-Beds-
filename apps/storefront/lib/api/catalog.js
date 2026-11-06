import { api } from "@/lib/api/client";

export async function getCategories({ next } = {}) {
  const data = await api.get("/catalog/categories", { next });
  return data.categories;
}

export async function getProducts({ category, q, page, pageSize, sort, deals, next } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  if (sort) params.set("sort", sort);
  if (deals) params.set("deals", "true");
  const query = params.toString();
  const data = await api.get(`/catalog/products${query ? `?${query}` : ""}`, { next });
  return data;
}

// Fetches every product in the category, not just one page of it. Needed so
// the storefront's sidebar filters (price/material/color/in-stock) and sort
// can work across a whole category instead of only the slice the API
// happened to paginate onto the current page — see
// components/shop/ProductGridWithControls.jsx, which does its own
// client-side pagination over this full set. 100 is the API's hard
// per-request cap (apps/api/src/routes/catalog.routes.js), so a category
// larger than that (e.g. Living Room, 400+) takes multiple requests here.
// The first request's `pagination.total` is what tells us how many more
// pages exist, so it has to resolve before the rest can be requested — but
// everything after that fires in parallel (Promise.all), not one-at-a-time:
// sequential awaits here would serialize ~20 round trips for a 400-product
// category into one long chain for no reason, since none of these requests
// depend on each other's results. This runs once per page load, not per
// filter click, so the remaining latency is a one-time cost, not a
// per-interaction one.
const MAX_PAGE_SIZE = 100;

export async function getAllProducts({ category, sort, next } = {}) {
  const first = await getProducts({ category, sort, page: 1, pageSize: MAX_PAGE_SIZE, next });
  const { total, pageSize } = first.pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const rest = await Promise.all(
    remainingPages.map((page) => getProducts({ category, sort, page, pageSize: MAX_PAGE_SIZE, next }))
  );

  const products = first.products.concat(...rest.map((result) => result.products));
  return { products, total };
}

export async function getProductBySlug(slug) {
  const data = await api.get(`/catalog/products/${slug}`);
  return data.product;
}
