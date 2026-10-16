import { api } from "@/lib/api/client";

export async function getCategories({ next } = {}) {
  const data = await api.get("/catalog/categories", { next });
  return data.categories;
}

export async function getProducts({ category, q, page, pageSize, next } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  const query = params.toString();
  const data = await api.get(`/catalog/products${query ? `?${query}` : ""}`, { next });
  return data;
}

export async function getProductBySlug(slug) {
  const data = await api.get(`/catalog/products/${slug}`);
  return data.product;
}
