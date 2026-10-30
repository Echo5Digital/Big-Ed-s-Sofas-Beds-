// Same placeholder contact details shown in the storefront footer
// (apps/storefront/lib/mock-data/site-config.js) — not real/verified
// business information yet. Duplicated here rather than imported because
// apps/storefront and apps/pos are independent Next.js apps with no
// cross-imports between them (shared data belongs in packages/, which this
// small, UI-only constant doesn't warrant on its own).
export const storeInfo = {
  name: "Big Ed's Sofas & Beds",
  phone: "(863) 555-0123",
  address: "17535 US Highway 27, Lake Wales, FL 33853",
};
