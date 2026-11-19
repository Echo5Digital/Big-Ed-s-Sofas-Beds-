const {
  computeOrderDisplayStatus,
  legalTargetStatusesForChannel,
  resolveOrderStatusFieldWrites,
} = require("./orderStatus.service");

// Pure functions, no Prisma/DB involved — see the module's own header
// comment for why these are the one deliberate exception to "never conflate
// status/paymentStatus/fulfillmentStatus" (docs/workflows/order-lifecycle.md).
describe("orderStatus.service — computeOrderDisplayStatus", () => {
  it("CANCELED overrides everything, for either channel", () => {
    expect(
      computeOrderDisplayStatus({ channel: "ONLINE", status: "CANCELED", paymentStatus: "PAID", fulfillmentStatus: "READY" })
    ).toBe("Canceled");
    expect(
      computeOrderDisplayStatus({ channel: "POS", status: "CANCELED", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "RESERVED" })
    ).toBe("Canceled");
  });

  describe("online ladder", () => {
    const base = { channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID" };

    it("UNALLOCATED and RESERVED both read as Ordered", () => {
      expect(computeOrderDisplayStatus({ ...base, fulfillmentStatus: "UNALLOCATED" })).toBe("Ordered");
      expect(computeOrderDisplayStatus({ ...base, fulfillmentStatus: "RESERVED" })).toBe("Ordered");
    });

    it("PROCESSING reads as Processing", () => {
      expect(computeOrderDisplayStatus({ ...base, fulfillmentStatus: "PROCESSING" })).toBe("Processing");
    });

    it("READY reads as Ready", () => {
      expect(computeOrderDisplayStatus({ ...base, fulfillmentStatus: "READY" })).toBe("Ready");
    });

    it("PICKED_UP and DELIVERED both read as Completed", () => {
      expect(computeOrderDisplayStatus({ ...base, fulfillmentStatus: "PICKED_UP" })).toBe("Completed");
      expect(computeOrderDisplayStatus({ ...base, fulfillmentStatus: "DELIVERED" })).toBe("Completed");
    });
  });

  describe("POS ladder", () => {
    it("PARTIALLY_PAID always reads as Draft, regardless of fulfillmentStatus", () => {
      expect(
        computeOrderDisplayStatus({ channel: "POS", status: "CONFIRMED", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "RESERVED" })
      ).toBe("Draft");
      expect(
        computeOrderDisplayStatus({ channel: "POS", status: "CONFIRMED", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "READY" })
      ).toBe("Draft");
    });

    it("PAID + RESERVED reads as Ordered", () => {
      expect(
        computeOrderDisplayStatus({ channel: "POS", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "RESERVED" })
      ).toBe("Ordered");
    });

    it("READY reads as Ready even if paymentStatus is PAID", () => {
      expect(
        computeOrderDisplayStatus({ channel: "POS", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "READY" })
      ).toBe("Ready");
    });

    it("PICKED_UP/DELIVERED read as Completed", () => {
      expect(
        computeOrderDisplayStatus({ channel: "POS", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "PICKED_UP" })
      ).toBe("Completed");
    });

    it("falls back to Draft for an order mid-creation (UNPAID/UNALLOCATED)", () => {
      expect(
        computeOrderDisplayStatus({ channel: "POS", status: "DRAFT", paymentStatus: "UNPAID", fulfillmentStatus: "UNALLOCATED" })
      ).toBe("Draft");
    });
  });
});

describe("orderStatus.service — legalTargetStatusesForChannel", () => {
  it("online offers Processing; POS does not", () => {
    expect(legalTargetStatusesForChannel("ONLINE")).toEqual(["Ordered", "Processing", "Ready", "Completed"]);
    expect(legalTargetStatusesForChannel("POS")).toEqual(["Ordered", "Ready", "Completed"]);
  });

  it("neither list includes Draft or Canceled — both are display-only", () => {
    for (const channel of ["ONLINE", "POS"]) {
      expect(legalTargetStatusesForChannel(channel)).not.toContain("Draft");
      expect(legalTargetStatusesForChannel(channel)).not.toContain("Canceled");
    }
  });
});

describe("orderStatus.service — resolveOrderStatusFieldWrites", () => {
  it("online Ordered/Processing/Ready map directly to fulfillmentStatus", () => {
    const order = { channel: "ONLINE", fulfillmentMethod: "PICKUP" };
    expect(resolveOrderStatusFieldWrites(order, "Ordered")).toEqual({ fulfillmentStatus: "RESERVED" });
    expect(resolveOrderStatusFieldWrites(order, "Processing")).toEqual({ fulfillmentStatus: "PROCESSING" });
    expect(resolveOrderStatusFieldWrites(order, "Ready")).toEqual({ fulfillmentStatus: "READY" });
  });

  it("Completed resolves to DELIVERED for a DELIVERY order, PICKED_UP otherwise", () => {
    expect(resolveOrderStatusFieldWrites({ channel: "ONLINE", fulfillmentMethod: "DELIVERY" }, "Completed")).toEqual({
      fulfillmentStatus: "DELIVERED",
    });
    expect(resolveOrderStatusFieldWrites({ channel: "ONLINE", fulfillmentMethod: "PICKUP" }, "Completed")).toEqual({
      fulfillmentStatus: "PICKED_UP",
    });
    expect(resolveOrderStatusFieldWrites({ channel: "POS", fulfillmentMethod: "IN_STORE" }, "Completed")).toEqual({
      fulfillmentStatus: "PICKED_UP",
    });
  });

  it("POS Ordered also marks paymentStatus PAID (settling a deposit's fulfillment track)", () => {
    expect(resolveOrderStatusFieldWrites({ channel: "POS", fulfillmentMethod: "IN_STORE" }, "Ordered")).toEqual({
      paymentStatus: "PAID",
      fulfillmentStatus: "RESERVED",
    });
  });

  it("throws for a target that isn't legal for the order's channel", () => {
    expect(() => resolveOrderStatusFieldWrites({ channel: "POS", fulfillmentMethod: "IN_STORE" }, "Processing")).toThrow(
      /not a valid status for a POS order/
    );
  });
});
