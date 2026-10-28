import { api, ApiClientError } from "@/lib/api/client";

// Customer sign-up / sign-in against apps/api's /customer-auth routes. Sessions
// live in httpOnly cookies the API sets (never readable from JavaScript), so
// these helpers only ever deal in the customer's public fields.

export function registerCustomer({ email, password, firstName, lastName }) {
  return api.post("/customer-auth/register", { email, password, firstName, lastName });
}

export async function verifyRegistrationCode({ pendingId, code }) {
  const data = await api.post("/customer-auth/verify-otp", { pendingId, code });
  return data.customer;
}

export function resendRegistrationCode({ pendingId }) {
  return api.post("/customer-auth/resend-otp", { pendingId });
}

export async function loginCustomer({ email, password }) {
  const data = await api.post("/customer-auth/login", { email, password });
  return data.customer;
}

export async function logoutCustomer() {
  await api.post("/customer-auth/logout");
}

// Resolves to the signed-in customer, or null when signed out. The access
// cookie lasts minutes while the refresh cookie lasts days, so a 401 from /me
// is retried once through /refresh before concluding the visitor is signed out.
// Anything other than a 401 (network failure, 500) is a real error and throws.
export async function getCurrentCustomer() {
  try {
    const data = await api.get("/customer-auth/me");
    return data.customer;
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
  }

  try {
    const data = await api.post("/customer-auth/refresh");
    return data.customer;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null;
    throw error;
  }
}
