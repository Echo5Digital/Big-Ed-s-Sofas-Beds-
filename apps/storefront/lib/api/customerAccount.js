import { api, ApiClientError } from "@/lib/api/client";

// Signed-in customer's own data, against apps/api's /customer-account routes.
// The session is an httpOnly cookie, so nothing here handles credentials.

// The access cookie lasts 15 minutes, the refresh cookie days. A 401 mid-visit
// usually just means the short one lapsed, so refresh once and retry the call.
// If the refresh itself is rejected the session is truly over, and that second
// 401 reaches the caller (see isSessionExpired).
async function withSession(call) {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
  }
  await api.post("/customer-auth/refresh");
  return call();
}

export function isSessionExpired(error) {
  return error instanceof ApiClientError && error.status === 401;
}

export async function getProfile() {
  const data = await withSession(() => api.get("/customer-account/profile"));
  return data.profile;
}

export async function updateProfile({ firstName, lastName, phone }) {
  const data = await withSession(() => api.patch("/customer-account/profile", { firstName, lastName, phone }));
  return data.profile;
}

export function changePassword({ currentPassword, newPassword }) {
  return withSession(() => api.post("/customer-account/change-password", { currentPassword, newPassword }));
}

export async function listAddresses() {
  const data = await withSession(() => api.get("/customer-account/addresses"));
  return data.addresses;
}

export async function createAddress(address) {
  const data = await withSession(() => api.post("/customer-account/addresses", address));
  return data.address;
}

export async function updateAddress(id, address) {
  const data = await withSession(() => api.patch(`/customer-account/addresses/${encodeURIComponent(id)}`, address));
  return data.address;
}

// Both of these resolve to the customer's full, re-ordered address list.
export async function setDefaultAddress(id) {
  const data = await withSession(() => api.post(`/customer-account/addresses/${encodeURIComponent(id)}/default`));
  return data.addresses;
}

export async function deleteAddress(id) {
  const data = await withSession(() => api.delete(`/customer-account/addresses/${encodeURIComponent(id)}`));
  return data.addresses;
}

export function listOrders({ page = 1, pageSize = 10 } = {}) {
  return withSession(() => api.get(`/customer-account/orders?page=${page}&pageSize=${pageSize}`));
}
