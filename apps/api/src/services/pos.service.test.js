const { prisma } = require("@big-eds/database");
const posService = require("./pos.service");
const inventoryService = require("./inventory.service");

// These tests run against the real dev database configured in
// packages/database/.env (per this repo's convention — no Prisma mock layer
// exists). Each test creates its own Product/Variant/Register fixtures and
// tears them down in afterAll, so it never touches seeded demo data and is
// safe to run repeatedly.
describe("pos.service", () => {
  let location;
  let register;
  let category;
  let product;
  let variant;

  beforeAll(async () => {
    category = await prisma.category.create({
      data: { name: "POS Test Category", slug: `pos-test-category-${Date.now()}` },
    });
    location = await prisma.location.create({
      data: { name: "POS Test Showroom", type: "SHOWROOM" },
    });
    register = await prisma.register.create({
      data: { name: "POS Test Register", locationId: location.id, isActive: true },
    });
    product = await prisma.product.create({
      data: {
        name: "Test Sofa",
        slug: `test-sofa-${Date.now()}`,
        status: "ACTIVE",
        categoryId: category.id,
      },
    });
    variant = await prisma.variant.create({
      data: {
        productId: product.id,
        sku: `TEST-SOFA-${Date.now()}`,
        name: "Default",
        priceCents: 50000,
      },
    });
  });

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({ where: { registerSession: { registerId: register.id } } });
    await prisma.receipt.deleteMany({ where: { registerSession: { registerId: register.id } } });
    const sessions = await prisma.registerSession.findMany({ where: { registerId: register.id } });
    await prisma.registerSession.deleteMany({ where: { registerId: register.id } });
    await prisma.register.delete({ where: { id: register.id } });

    const orders = await prisma.order.findMany({ where: { lines: { some: { variantId: variant.id } } } });
    for (const order of orders) {
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.refund.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    await prisma.stockMovement.deleteMany({ where: { variantId: variant.id } });
    await prisma.reservation.deleteMany({ where: { variantId: variant.id } });
    await prisma.stockBalance.deleteMany({ where: { variantId: variant.id } });
    await prisma.variant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.location.delete({ where: { id: location.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.$disconnect();

    void sessions;
  });

  async function seedStock(quantity) {
    await prisma.stockBalance.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
      update: { onHand: quantity, reserved: 0 },
      create: { variantId: variant.id, locationId: location.id, onHand: quantity },
    });
  }

  it("opens a register session and rejects opening it twice", async () => {
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 10000 });
    expect(session.status).toBe("OPEN");
    expect(session.openingCashCents).toBe(10000);

    await expect(
      posService.openRegister({ registerId: register.id, openingCashCents: 5000 })
    ).rejects.toThrow(/already has an open session/);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 10000 });
  });

  it("rings a cash sale, decrements stock, and computes change due", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 2 }],
      payments: [{ method: "CASH", amountCents: 110000 }], // 2 x 50000 = 100000 due, tendered 110000
      performedById: null,
    });

    expect(result.order.channel).toBe("POS");
    expect(result.order.paymentStatus).toBe("PAID");
    expect(result.payments).toHaveLength(1);
    // Payment/CashMovement record what's actually kept (100000), not the
    // raw 110000 handed over — the 10000 difference is change, tracked only
    // in changeDueCents, never as money the register actually retained.
    expect(result.payments[0].amountCents).toBe(100000);
    expect(result.changeDueCents).toBe(10000);

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(3); // 5 - 2
    expect(balance.reserved).toBe(0); // reservation converted, not left dangling

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 100000 });
  });

  it("applies a discount with a reason code and charges the discounted total", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 45000 }],
      discountCents: 5000,
      discountReasonCode: "manager_price_match",
      performedById: null,
    });

    expect(result.order.subtotalCents).toBe(50000);
    expect(result.order.totalCents).toBe(45000);
    expect(result.payments[0].amountCents).toBe(45000);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityId: result.order.id, action: "pos.sale.discount" },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry.reasonCode).toBe("manager_price_match");

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 45000 });
  });

  it("rejects a discount with no reason code at the validation layer", () => {
    const { posSaleSchema } = require("@big-eds/validation");
    const result = posSaleSchema.safeParse({
      registerSessionId: register.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 45000 }],
      discountCents: 5000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects CARD tender without writing any order or stock change", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    await expect(
      posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CARD", amountCents: 50000 }],
        performedById: null,
      })
    ).rejects.toThrow(/Card-present tender is not available/);

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(5); // unchanged

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("records a deposit sale as PARTIALLY_PAID when less than the full total", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "DEPOSIT", amountCents: 20000 }],
      performedById: null,
    });

    expect(result.order.paymentStatus).toBe("PARTIALLY_PAID");
    expect(result.payments[0].amountCents).toBe(20000);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("rejects a sale when available stock is insufficient (no phantom sale)", async () => {
    await seedStock(1);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    await expect(
      posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 2 }],
        payments: [{ method: "CASH", amountCents: 100000 }],
        performedById: null,
      })
    ).rejects.toThrow();

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    expect(balance.onHand).toBe(1); // untouched — order was rolled back, not half-sold

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("never sells the last unit twice when POS and a direct reservation race for it", async () => {
    await seedStock(1);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    // Simulates the kickoff plan's explicit cross-channel acceptance test:
    // the last unit, contended by two concurrent buyers, must be sold to
    // exactly one of them.
    const attempt1 = posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 50000 }],
      performedById: null,
    });
    const attempt2 = inventoryService.reserveStock({
      variantId: variant.id,
      locationId: location.id,
      quantity: 1,
      orderId: null,
    });

    const results = await Promise.allSettled([attempt1, attempt2]);
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    const balance = await prisma.stockBalance.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    });
    // Either the POS sale won (onHand 0, reserved 0) or the reservation won
    // (onHand 1, reserved 1) — never both succeeding, which would require 2
    // units from a stock of 1.
    const soldUnits = (1 - balance.onHand) + balance.reserved;
    expect(soldUnits).toBe(1);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("reconciles register closeout cash against recorded movements and flags a discrepancy", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 10000 });

    await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 50000 }],
      performedById: null,
    });

    // Expected: 10000 opening + 50000 cash sale = 60000. Cashier counts short.
    const closed = await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 55000 });

    expect(closed.expectedCashCents).toBe(60000);
    expect(closed.discrepancyCents).toBe(-5000);
    expect(closed.status).toBe("CLOSED");
  });

  it("processes a refund, caps it at the order total, and writes a cash movement", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const sale = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 50000 }],
      performedById: null,
    });

    await expect(
      posService.refund({
        registerSessionId: session.id,
        orderId: sale.order.id,
        amountCents: 999999,
        reasonCode: "test_overage",
        performedById: null,
      })
    ).rejects.toThrow(/exceed the order total/);

    const refundRecord = await posService.refund({
      registerSessionId: session.id,
      orderId: sale.order.id,
      amountCents: 50000,
      reasonCode: "test_refund",
      performedById: null,
    });
    expect(refundRecord.amountCents).toBe(50000);

    const order = await prisma.order.findUnique({ where: { id: sale.order.id } });
    expect(order.paymentStatus).toBe("REFUNDED");

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  it("never lets two concurrent refunds on the same order jointly exceed the order total", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const sale = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 50000 }],
      performedById: null,
    });

    // Fire two refunds for the full order total at the same time — without
    // the order-row lock in pos.service.js's refund(), both could read the
    // same refundedSoFar=0 snapshot, both pass the "<=  order total" check,
    // and both commit, refunding 100000 against a 50000 order.
    const results = await Promise.allSettled([
      posService.refund({
        registerSessionId: session.id,
        orderId: sale.order.id,
        amountCents: 50000,
        reasonCode: "test_concurrent_a",
        performedById: null,
      }),
      posService.refund({
        registerSessionId: session.id,
        orderId: sale.order.id,
        amountCents: 50000,
        reasonCode: "test_concurrent_b",
        performedById: null,
      }),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);
    expect(failed[0].reason.message).toMatch(/exceed the order total/);

    const totalRefunded = await prisma.refund.aggregate({
      where: { orderId: sale.order.id },
      _sum: { amountCents: true },
    });
    expect(totalRefunded._sum.amountCents).toBe(50000);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
  });

  describe("split payments", () => {
    it("completes a sale tendered across cash and deposit entries", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // 50000 total: 30000 cash + 20000 deposit.
      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [
          { method: "CASH", amountCents: 30000 },
          { method: "DEPOSIT", amountCents: 20000 },
        ],
        performedById: null,
      });

      expect(result.order.paymentStatus).toBe("PAID");
      expect(result.payments).toHaveLength(2);
      expect(result.payments.reduce((sum, p) => sum + p.amountCents, 0)).toBe(50000);
      expect(result.changeDueCents).toBe(0);

      const movements = await prisma.cashMovement.findMany({ where: { registerSessionId: session.id } });
      expect(movements.filter((m) => m.type === "SALE")).toHaveLength(1); // only the cash entry
      expect(movements.filter((m) => m.type === "DEPOSIT")).toHaveLength(1);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 30000 });
    });

    it("records only the applied (not raw tendered) amount for an overtendered cash entry", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // 50000 total, tendered 20000 cash + 40000 cash (overtender by 10000).
      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [
          { method: "CASH", amountCents: 20000 },
          { method: "CASH", amountCents: 40000 },
        ],
        performedById: null,
      });

      expect(result.changeDueCents).toBe(10000);
      const totalRecorded = result.payments.reduce((sum, p) => sum + p.amountCents, 0);
      expect(totalRecorded).toBe(50000); // never 60000 — change is never recorded as kept money

      const movements = await prisma.cashMovement.findMany({ where: { registerSessionId: session.id, type: "SALE" } });
      const movementTotal = movements.reduce((sum, m) => sum + m.amountCents, 0);
      expect(movementTotal).toBe(50000);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 50000 });
    });

    it("rejects a non-cash entry (e.g. bank transfer) that exceeds the remaining balance", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.ringSale({
          registerSessionId: session.id,
          lines: [{ variantId: variant.id, quantity: 1 }],
          payments: [{ method: "BANK_TRANSFER", amountCents: 60000 }], // 50000 due
          performedById: null,
        })
      ).rejects.toThrow(/cannot exceed the order total/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });

    it("rejects a STORE_CREDIT entry with no customer attached to the sale", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.ringSale({
          registerSessionId: session.id,
          lines: [{ variantId: variant.id, quantity: 1 }],
          payments: [{ method: "STORE_CREDIT", amountCents: 50000 }],
          performedById: null,
        })
      ).rejects.toThrow(/identified customer/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });

    it("redeems store credit as a sale tender and debits the customer's balance", async () => {
      const storeCreditService = require("./storeCredit.service");
      const customer = await prisma.customer.create({
        data: { firstName: "Split", lastName: "Payment Test", phone: `555-${Date.now().toString().slice(-7)}` },
      });
      await prisma.$transaction((tx) =>
        storeCreditService.issueStoreCredit(tx, { customerId: customer.id, amountCents: 20000, performedById: null })
      );

      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [
          { method: "STORE_CREDIT", amountCents: 20000 },
          { method: "CASH", amountCents: 30000 },
        ],
        customerId: customer.id,
        performedById: null,
      });

      expect(result.order.paymentStatus).toBe("PAID");
      const remainingBalance = await storeCreditService.getStoreCreditBalance(customer.id);
      expect(remainingBalance).toBe(0);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 30000 });
      await prisma.storeCredit.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    });

    it("rejects an under-tendered sale with no deposit entry present", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.ringSale({
          registerSessionId: session.id,
          lines: [{ variantId: variant.id, quantity: 1 }],
          payments: [{ method: "CASH", amountCents: 10000 }], // 50000 due
          performedById: null,
        })
      ).rejects.toThrow(/less than the amount due/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });
  });

  describe("reopen approval", () => {
    it("moves a stuck OPEN session to PENDING_REOPEN_APPROVAL and blocks opening the register", async () => {
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 10000 });

      const requested = await posService.requestReopen({ registerSessionId: session.id, requestedById: null });
      expect(requested.status).toBe("PENDING_REOPEN_APPROVAL");
      expect(requested.reopenRequestedAt).not.toBeNull();

      await expect(
        posService.openRegister({ registerId: register.id, openingCashCents: 0 })
      ).rejects.toThrow(/awaiting manager approval/);

      // denyReopen sends the session back to OPEN (by design — the register
      // stays locked, not freed) so it must still be closed out normally
      // afterward, same as any other stuck-open session, or it leaks into
      // later tests sharing this fixture register.
      await posService.denyReopen({ registerSessionId: session.id, reason: null, performedById: null });
      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 10000 });
    });

    it("rejects requesting reopen on a session that isn't OPEN", async () => {
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });

      await expect(
        posService.requestReopen({ registerSessionId: session.id, requestedById: null })
      ).rejects.toThrow(/stuck, currently-open/);
    });

    it("approving reconciles cash and closes the session, freeing the register", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 10000 });
      await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 50000 }],
        performedById: null,
      });

      await posService.requestReopen({ registerSessionId: session.id, requestedById: null });

      const pending = await posService.listPendingReopens();
      expect(pending.some((s) => s.id === session.id)).toBe(true);

      // Expected: 10000 opening + 50000 cash sale = 60000.
      const approved = await posService.approveReopen({
        registerSessionId: session.id,
        closingCashCents: 60000,
        performedById: null,
      });
      expect(approved.status).toBe("CLOSED");
      expect(approved.expectedCashCents).toBe(60000);
      expect(approved.discrepancyCents).toBe(0);
      expect(approved.reopenApprovedAt).not.toBeNull();

      const stillPending = await posService.listPendingReopens();
      expect(stillPending.some((s) => s.id === session.id)).toBe(false);

      // The register is free again — opening a new session now succeeds.
      const reopened = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
      expect(reopened.status).toBe("OPEN");
      await posService.closeRegister({ registerSessionId: reopened.id, closingCashCents: 0 });
    });

    it("denying sends the session back to OPEN instead of closing it", async () => {
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 5000 });
      await posService.requestReopen({ registerSessionId: session.id, requestedById: null });

      const denied = await posService.denyReopen({
        registerSessionId: session.id,
        reason: "Drawer needs an in-person count",
        performedById: null,
      });
      expect(denied.status).toBe("OPEN");
      expect(denied.reopenDeniedAt).not.toBeNull();
      expect(denied.reopenDenialReason).toBe("Drawer needs an in-person count");

      // Still blocked from opening (status is OPEN, not freed) — same as any
      // other stuck-open register.
      await expect(
        posService.openRegister({ registerId: register.id, openingCashCents: 0 })
      ).rejects.toThrow(/already has an open session/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 5000 });
    });

    it("rejects approving or denying a session that isn't pending", async () => {
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.approveReopen({ registerSessionId: session.id, closingCashCents: 0, performedById: null })
      ).rejects.toThrow(/not awaiting reopen approval/);
      await expect(
        posService.denyReopen({ registerSessionId: session.id, reason: null, performedById: null })
      ).rejects.toThrow(/not awaiting reopen approval/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });
  });
});
