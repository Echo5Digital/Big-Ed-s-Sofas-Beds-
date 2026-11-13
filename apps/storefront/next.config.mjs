/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Admin-uploaded product images are stored in Cloudinary — see
      // apps/api/src/routes/catalog.routes.js.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Old product detail URLs moved under /shop — see app/shop/[...slug]/page.jsx,
  // which now also serves product pages. Sub-category URLs (old flat
  // /shop/sub-slug -> /shop/parent-slug/sub-slug) can't redirect statically
  // since the parent segment must be looked up against the live category
  // list; that redirect happens inside the route itself instead.
  async redirects() {
    return [
      {
        source: "/products/:slug",
        destination: "/shop/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
