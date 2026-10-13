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

async function request(path, options = {}) {
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
