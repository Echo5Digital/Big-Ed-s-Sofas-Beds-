// Always call the API's absolute URL directly — both server-side (SSR) and
// client-side (browser fetch). In production the POS app (Vercel) and the
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

// The access token cookie expires after 15 minutes (apps/api/src/lib/env.js
// accessTokenTtlMinutes), but a register session routinely stays open far
// longer than that while a cashier works the floor between sales. Without
// this, the first request after expiry — ringing up a sale, settling a
// balance, confirming a return — threw a plain 401 that every "Confirm"
// button's own catch block surfaced as a generic failure, and clicking
// Confirm again just 401'd the same way, since nothing ever refreshed the
// token; it read as "the Confirm button doesn't work" with no indication a
// session timeout was the actual cause. POST /auth/refresh (apps/api/src/
// routes/auth.routes.js) already existed and reissues the access-token
// cookie from the refresh-token cookie — same fix already applied to
// apps/admin/lib/api/client.js, ported here.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, { method: "POST", credentials: "include" }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request(path, options = {}, isRetry = false) {
  const url = `${API_BASE}/api${path}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Never intercept /auth/* itself — refreshing in response to a failed
  // refresh/login/logout call would loop or mask the real error.
  if (response.status === 401 && !isRetry && !path.startsWith("/auth/")) {
    const refreshResponse = await refreshAccessToken();
    if (refreshResponse.ok) {
      return request(path, options, true);
    }
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiClientError(payload?.error?.message || "Request failed", response.status, payload?.error?.details);
  }

  return payload;
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export { ApiClientError };
