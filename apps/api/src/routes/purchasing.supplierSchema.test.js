const { supplierUpdateSchema } = require("@big-eds/validation");

// Pure schema tests — no database. The PATCH /purchasing/suppliers/:id route
// validates its body with this schema (the admin Suppliers page's
// Activate / Deactivate button sends { isActive }).
describe("supplierUpdateSchema — PATCH /purchasing/suppliers/:id body", () => {
  it("accepts a lone isActive flag (Activate / Deactivate button)", () => {
    expect(supplierUpdateSchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(supplierUpdateSchema.parse({ isActive: true })).toEqual({ isActive: true });
  });

  it("accepts a partial profile edit without requiring name", () => {
    expect(supplierUpdateSchema.parse({ leadTimeDays: 14 })).toEqual({ leadTimeDays: 14 });
  });

  it("rejects an empty body", () => {
    expect(supplierUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-boolean isActive", () => {
    expect(supplierUpdateSchema.safeParse({ isActive: "false" }).success).toBe(false);
    expect(supplierUpdateSchema.safeParse({ isActive: 0 }).success).toBe(false);
  });

  it("keeps the create-schema rules on shared fields", () => {
    expect(supplierUpdateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(supplierUpdateSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(supplierUpdateSchema.safeParse({ leadTimeDays: -1 }).success).toBe(false);
  });

  it("strips fields the Supplier model should never take from a client (id, createdAt, ...)", () => {
    const parsed = supplierUpdateSchema.parse({ isActive: false, id: "forged", createdAt: "2000-01-01", purchaseOrders: [] });
    expect(parsed).toEqual({ isActive: false });
  });
});
