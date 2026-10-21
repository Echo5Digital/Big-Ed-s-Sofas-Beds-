// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import Link from "next/link";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { getCategories, getProducts } from "@/lib/api/catalog";
import { blogPosts } from "@/lib/mock-data/blog";

export const metadata = {
  title: "Site Map | Big Ed's Sofas & Beds",
  description: "A full listing of pages on the Big Ed's Sofas & Beds website.",
};

function SitemapSection({ title, links }) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-brand-charcoal">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-brand-charcoal/75 hover:text-brand-red-dark hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SitemapPage() {
  const mainPages = [
    { label: "Home", href: "/" },
    { label: "Shop All", href: "/shop" },
    { label: "Deals", href: "/deals" },
    { label: "Financing", href: "/financing" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Careers", href: "/careers" },
    { label: "Blog", href: "/blog" },
  ];

  const accountPages = [
    { label: "Cart", href: "/cart" },
    { label: "Checkout", href: "/checkout" },
    { label: "Account", href: "/account" },
    { label: "Wishlist", href: "/wishlist" },
  ];

  const [allCategories, { products: allProducts }] = await Promise.all([
    getCategories(),
    getProducts({ pageSize: 100 }),
  ]);
  const shopByRoom = allCategories
    .filter((c) => !c.parentId)
    .map((group) => ({ label: group.name, href: `/shop/${group.slug}` }));
  const shopByCategory = allCategories
    .filter((c) => c.parentId)
    .map((category) => ({ label: category.name, href: `/shop/${category.slug}` }));
  const productLinks = allProducts.map((product) => ({ label: product.name, href: `/products/${product.slug}` }));
  const blogLinks = blogPosts.map((post) => ({ label: post.title, href: `/blog/${post.slug}` }));

  const legalPages = [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Shipping & Delivery", href: "/shipping-delivery" },
    { label: "Returns", href: "/returns" },
    { label: "Site Map", href: "/sitemap" },
  ];

  return (
    <div className="py-8 sm:py-10">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Site Map" }]} />

        <h1 className="mt-4 font-display text-3xl font-bold text-brand-charcoal sm:text-4xl">
          Site Map
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-charcoal/70 sm:text-base">
          A full listing of every page on the Big Ed&rsquo;s Sofas &amp; Beds website.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <SitemapSection title="Main Pages" links={mainPages} />
          <SitemapSection title="Shop by Room" links={shopByRoom} />
          <SitemapSection title="Shop by Category" links={shopByCategory} />
          <SitemapSection title="Your Account" links={accountPages} />
          <SitemapSection title="Blog Articles" links={blogLinks} />
          <SitemapSection title="Legal" links={legalPages} />
        </div>

        <div className="mt-10">
          <SitemapSection title="All Products" links={productLinks} />
        </div>
      </Container>
    </div>
  );
}
