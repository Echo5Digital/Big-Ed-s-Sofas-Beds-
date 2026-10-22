// Always call the API's absolute URL directly — both server-side (SSR) and
// client-side (browser fetch). In production the admin app (Vercel) and the
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
// accessTokenTtlMinutes) but a session can easily stay open longer than
// that. Without this, the first request after expiry threw a plain 401,
// useAuth treated any /auth/me failure as "logged out" (it can't tell token
// expiry apart from an actual invalid session), and the user was bounced to
// /login mid-session even though their 7-day refresh token was still valid.
// POST /auth/refresh (apps/api/src/routes/auth.routes.js) already existed
// and reissues the access-token cookie from the refresh-token cookie, but
// nothing client-side ever called it — this is that missing call.
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

async function upload(path, formData, isRetry = false) {
  const url = `${API_BASE}/api${path}`;
  // No Content-Type header: the browser sets multipart/form-data with the
  // correct boundary itself. Setting it manually (as request() does for
  // JSON) would omit the boundary and the server couldn't parse the body.
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (response.status === 401 && !isRetry) {
    const refreshResponse = await refreshAccessToken();
    if (refreshResponse.ok) {
      return upload(path, formData, true);
    }
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiClientError(payload?.error?.message || "Upload failed", response.status, payload?.error?.details);
  }

  return payload;
}

// Rarely-changing reference data (categories, locations) was being refetched
// from scratch on every single page mount with no sharing across
// navigations — each call pays a full round trip to the remote DB plus
// requireAuth's per-request permission lookup, which added up to
// noticeably sluggish navigation across the admin app. A short in-memory
// cache (cleared on a hard page reload, same as everything else in this
// module) avoids repeat fetches of the same data within one browsing
// session, without touching how fast any single request or auth check is.
const GET_CACHE_TTL_MS = 60 * 1000;
const getCache = new Map();

function getCached(path) {
  const cached = getCache.get(path);
  if (cached && Date.now() - cached.timestamp < GET_CACHE_TTL_MS) {
    return cached.promise;
  }
  const promise = request(path, { method: "GET" }).catch((err) => {
    getCache.delete(path);
    throw err;
  });
  getCache.set(path, { promise, timestamp: Date.now() });
  return promise;
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  getCached,
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload,
};

export { ApiClientError };
