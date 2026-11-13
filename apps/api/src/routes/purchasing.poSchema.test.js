const { purchaseOrderCreateSchema, goodsReceiptCreateSchema } = require("@big-eds/validation");

// Pure schema tests — no database. Covers the PO-level -> per-line move of
// expectedDate (POST /purchasing/purchase-orders) and the new pendingNote
// field on a receipt line (POST /purchase-orders/:id/receive).
describe("purchaseOrderCreateSchema — POST /purchasing/purchase-orders body", () => {
  const base = {
    supplierId: "11111111-1111-1111-1111-111111111111",
    locationId: "22222222-2222-2222-2222-222222222222",
  };

  it("accepts a line with its own expectedDate", () => {
    const parsed = purchaseOrderCreateSchema.parse({
      ...base,
      lines: [
        {
          variantId: "33333333-3333-3333-3333-333333333333",
          expectedQty: 5,
          unitCostCents: 1000,
          expectedDate: "2026-12-01T00:00:00.000Z",
        },
      ],
    });
    expect(parsed.lines[0].expectedDate).toBe("2026-12-01T00:00:00.000Z");
  });

  it("accepts a line with no expectedDate at all", () => {
    const parsed = purchaseOrderCreateSchema.parse({
      ...base,
      lines: [{ variantId: "33333333-3333-3333-3333-333333333333", expectedQty: 5, unitCostCents: 1000 }],
    });
    expect(parsed.lines[0].expectedDate).toBeUndefined();
  });

  it("no longer accepts/recognizes a top-level expectedDate (moved to per-line)", () => {
    const parsed = purchaseOrderCreateSchema.parse({
      ...base,
      expectedDate: "2026-12-01T00:00:00.000Z",
      lines: [{ variantId: "33333333-3333-3333-3333-333333333333", expectedQty: 5, unitCostCents: 1000 }],
    });
    expect(parsed.expectedDate).toBeUndefined();
  });

  it("rejects a line with a non-ISO expectedDate", () => {
    const result = purchaseOrderCreateSchema.safeParse({
      ...base,
      lines: [
        {
          variantId: "33333333-3333-3333-3333-333333333333",
          expectedQty: 5,
          unitCostCents: 1000,
          expectedDate: "not-a-date",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("goodsReceiptCreateSchema — POST /purchase-orders/:id/receive body", () => {
  const base = { locationId: "22222222-2222-2222-2222-222222222222" };

  it("accepts a line with a pendingNote", () => {
    const parsed = goodsReceiptCreateSchema.parse({
      ...base,
      lines: [{ poLineId: "44444444-4444-4444-4444-444444444444", acceptedQty: 3, pendingNote: "balance owed" }],
    });
    expect(parsed.lines[0].pendingNote).toBe("balance owed");
  });

  it("accepts a line with no pendingNote (leaves any prior note untouched)", () => {
    const parsed = goodsReceiptCreateSchema.parse({
      ...base,
      lines: [{ poLineId: "44444444-4444-4444-4444-444444444444", acceptedQty: 3 }],
    });
    expect(parsed.lines[0].pendingNote).toBeUndefined();
  });

  it("rejects a pendingNote over 500 characters", () => {
    const result = goodsReceiptCreateSchema.safeParse({
      ...base,
      lines: [
        {
          poLineId: "44444444-4444-4444-4444-444444444444",
          acceptedQty: 3,
          pendingNote: "x".repeat(501),
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
