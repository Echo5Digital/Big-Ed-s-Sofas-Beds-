import { getSiteUrl } from "@/lib/siteUrl";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/account"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
