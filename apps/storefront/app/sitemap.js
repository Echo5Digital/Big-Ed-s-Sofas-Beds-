import { getSiteUrl } from "@/lib/siteUrl";
import { getCategories, getProducts } from "@/lib/api/catalog";
import { blogPosts } from "@/lib/mock-data/blog";

const STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/deals", changeFrequency: "daily", priority: 0.8 },
  { path: "/financing", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/careers", changeFrequency: "monthly", priority: 0.3 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms-of-service", changeFrequency: "yearly", priority: 0.2 },
  { path: "/shipping-delivery", changeFrequency: "yearly", priority: 0.2 },
  { path: "/returns", changeFrequency: "yearly", priority: 0.2 },
];

// Account/cart/checkout are deliberately excluded — they're per-user pages
// with nothing for a search engine to index, and robots.js already
// disallows crawling them.
export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const [categories, { products }] = await Promise.all([
    getCategories(),
    getProducts({ pageSize: 100 }),
  ]);

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const categoryEntries = categories.map((category) => ({
    url: `${siteUrl}/shop/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productEntries = products.map((product) => ({
    url: `${siteUrl}/products/${product.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const blogEntries = blogPosts.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries, ...blogEntries];
}
