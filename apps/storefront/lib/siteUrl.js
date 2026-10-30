// No fixed production domain is configured yet (Vercel-only deploy, no
// custom domain). Vercel sets these automatically at build/runtime, so the
// sitemap/robots routes always point at whatever URL is actually serving
// the site instead of a hardcoded guess:
// - VERCEL_PROJECT_PRODUCTION_URL: the stable production domain, when a
//   production deployment exists.
// - VERCEL_URL: the current deployment's own URL (preview or production),
//   always set when running on Vercel.
// Falls back to localhost for local dev.
export function getSiteUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (host) return `https://${host}`;
  return "http://localhost:3000";
}
