// Always call the API's absolute URL directly — both server-side (SSR) and
// client-side (browser fetch). In production the storefront (Vercel) and the
// API (Render) are different domains, so a same-origin relative path can't
// reach the API at all; NEXT_PUBLIC_* is exposed to the browser bundle by
// Next.js specifically so this works client-side too.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class ApiClientError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}/api${path}`;
  const { next, ...rest } = options;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...rest.headers,
    },
    ...rest,
    body: rest.body ? JSON.stringify(rest.body) : undefined,
    // Omit `cache`/`next` entirely by default so GETs stay live (fetch's own
    // default is "no-store" once any request in the app opts into caching —
    // callers that can tolerate staleness pass `next` explicitly, e.g. the
    // homepage's category/featured-product teasers; see app/page.jsx).
    ...(next ? { next } : {}),
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiClientError(payload?.error?.message || "Request failed", response.status, payload?.error?.details);
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { method: "GET", ...options }),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export { ApiClientError };
