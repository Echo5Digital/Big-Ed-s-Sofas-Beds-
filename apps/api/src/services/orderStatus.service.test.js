const {
  computeOrderDisplayStatus,
  legalTargetStatusesForChannel,
  resolveOrderStatusFieldWrites,
  orderWhereForDisplayStatus,
} = require("./orderStatus.service");

// Minimal in-memory predicate matcher for the small subset of Prisma
// where-clause shapes orderWhereForDisplayStatus actually produces (plain
// equality, { not }, { in }, and a top-level AND/OR array of the same) — just
// enough to let these tests assert the where-clause and
// computeOrderDisplayStatus never disagree, without a real database.
function matches(where, order) {
  // AND/OR/NOT can appear ALONGSIDE plain field conditions in the same
  // where-object (Prisma ANDs every top-level key together) — e.g.
  // { AND: [...], fulfillmentStatus: "READY" } requires both the AND group
  // AND fulfillmentStatus to hold, so these are checked as conditions to
  // combine with the rest below, never as an early return on their own.
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return condition.every((w) => matches(w, order));
    if (key === "OR") return condition.some((w) => matches(w, order));
    if (key === "NOT") return !matches(condition, order);
    if (condition && typeof condition === "object") {
      if ("not" in condition) return order[key] !== condition.not;
      if ("in" in condition) return condition.in.includes(order[key]);
    }
    return order[key] === condition;
  });
}

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

describe("orderStatus.service — orderWhereForDisplayStatus", () => {
  // Every order from the computeOrderDisplayStatus suite above, re-used here
  // so the two functions are tested against the exact same fixtures — the
  // property under test is that they never disagree, for either channel.
  const sampleOrders = [
    { channel: "ONLINE", status: "CANCELED", paymentStatus: "PAID", fulfillmentStatus: "READY" },
    { channel: "POS", status: "CANCELED", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "RESERVED" },
    { channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "UNALLOCATED" },
    { channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "RESERVED" },
    { channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "PROCESSING" },
    { channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "READY" },
    { channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "PICKED_UP" },
    { channel: "ONLINE", status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "DELIVERED" },
    { channel: "POS", status: "CONFIRMED", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "RESERVED" },
    { channel: "POS", status: "CONFIRMED", paymentStatus: "PARTIALLY_PAID", fulfillmentStatus: "READY" },
    { channel: "POS", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "RESERVED" },
    { channel: "POS", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "READY" },
    { channel: "POS", status: "CONFIRMED", paymentStatus: "PAID", fulfillmentStatus: "PICKED_UP" },
    { channel: "POS", status: "DRAFT", paymentStatus: "UNPAID", fulfillmentStatus: "UNALLOCATED" },
  ];

  it.each(["Ordered", "Processing", "Ready", "Completed", "Canceled"])(
    "%s matches exactly the orders computeOrderDisplayStatus also labels %s",
    (label) => {
      const where = orderWhereForDisplayStatus(label);
      for (const order of sampleOrders) {
        expect(matches(where, order)).toBe(computeOrderDisplayStatus(order) === label);
      }
    }
  );

  it("throws for a label that isn't one of the five filterable statuses", () => {
    expect(() => orderWhereForDisplayStatus("Draft")).toThrow(/not a filterable order status/);
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
