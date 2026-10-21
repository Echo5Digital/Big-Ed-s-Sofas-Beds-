/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Admin-uploaded product images served from apps/api's local-disk
      // /uploads route — see apps/api/src/routes/catalog.routes.js. Update
      // this to the deployed API host for production uploads.
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
    // Next's SSRF guard blocks the image optimizer from fetching private/
    // localhost IPs by default. Safe to allow here only because this rule is
    // scoped to the exact localhost:4000 pattern above — the local API in
    // dev — never a production host.
    dangerouslyAllowLocalIP: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
