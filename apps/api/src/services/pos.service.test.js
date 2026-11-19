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
        // Zeroed so every pre-existing total/discount assertion in this file
        // stays about discount/cost-floor behavior, not tax — tax has its
        // own dedicated describe block below with its own non-zero-rate
        // fixture.
        taxRatePercent: 0,
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
    const addressIdsToClean = orders.flatMap((o) => [o.shippingAddressId, o.billingAddressId]).filter(Boolean);
    for (const order of orders) {
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.refund.deleteMany({ where: { orderId: order.id } });
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      await prisma.orderSalesAttribution.deleteMany({ where: { orderId: order.id } });
      // Clear the address FKs before deleting so the SetNull isn't racing the
      // order delete itself, then delete the now-orphaned snapshot rows.
      await prisma.order.update({ where: { id: order.id }, data: { shippingAddressId: null, billingAddressId: null } });
      await prisma.order.delete({ where: { id: order.id } });
    }
    if (addressIdsToClean.length) {
      await prisma.address.deleteMany({ where: { id: { in: addressIdsToClean } } });
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
    // 60s timeout: the sequential per-order cleanup loop above runs against
    // the real (remote) dev database, and this file's order count has grown
    // enough to exceed Vitest's default 30s hook timeout.
  }, 60000);

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

  it("applies a flat-cents discount with a reason code and charges the discounted total", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 45000 }],
      discount: { mode: "FLAT_CENTS", amountCents: 5000 },
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
    expect(auditEntry.metadata.discountMode).toBe("FLAT_CENTS");
    expect(auditEntry.metadata.approvedViaPin).toBe(false);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 45000 });
  });

  it("applies a percent-mode discount, resolving discountCents server-side from the subtotal", async () => {
    await seedStock(5);
    const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

    // 50000 subtotal, 10% = 5000 discount -> 45000 total. Under the 10%
    // ceiling, so no PIN needed.
    const result = await posService.ringSale({
      registerSessionId: session.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 45000 }],
      discount: { mode: "PERCENT", percent: 10 },
      discountReasonCode: "loyalty_discount",
      performedById: null,
    });

    expect(result.order.discountCents).toBe(5000);
    expect(result.order.discountPercent).toBe(10);
    expect(result.order.totalCents).toBe(45000);

    await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 45000 });
  });

  it("rejects a discount with no reason code at the validation layer", () => {
    const { posSaleSchema } = require("@big-eds/validation");
    const result = posSaleSchema.safeParse({
      registerSessionId: register.id,
      lines: [{ variantId: variant.id, quantity: 1 }],
      payments: [{ method: "CASH", amountCents: 45000 }],
      discount: { mode: "FLAT_CENTS", amountCents: 5000 },
    });
    expect(result.success).toBe(false);
  });

  describe("discount PIN override", () => {
    let manager;
    let cashierWithPin;
    const MANAGER_PIN = "1234";
    const CASHIER_PIN = "9876"; // distinct from the manager's, so matching it proves the cashier's own hash was tried and still rejected

    beforeAll(async () => {
      const { hashPin } = require("../lib/posPin");
      const managerRole = await prisma.role.findUnique({ where: { name: "MANAGER" } });
      const cashierRole = await prisma.role.findUnique({ where: { name: "CASHIER" } });

      manager = await prisma.user.create({
        data: {
          email: `pos-pin-manager-${Date.now()}@test.local`,
          passwordHash: "unused",
          firstName: "Pin",
          lastName: "Manager",
          posPinHash: await hashPin(MANAGER_PIN),
          roles: { create: [{ roleId: managerRole.id }] },
        },
      });
      cashierWithPin = await prisma.user.create({
        data: {
          email: `pos-pin-cashier-${Date.now()}@test.local`,
          passwordHash: "unused",
          firstName: "Pin",
          lastName: "Cashier",
          posPinHash: await hashPin(CASHIER_PIN),
          roles: { create: [{ roleId: cashierRole.id }] },
        },
      });
    });

    afterAll(async () => {
      await prisma.orderSalesAttribution.deleteMany({ where: { userId: { in: [manager.id, cashierWithPin.id] } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: [manager.id, cashierWithPin.id] } } });
      await prisma.order.updateMany({
        where: { discountApprovedById: { in: [manager.id, cashierWithPin.id] } },
        data: { discountApprovedById: null },
      });
      await prisma.auditLog.deleteMany({ where: { userId: { in: [manager.id, cashierWithPin.id] } } });
      await prisma.user.delete({ where: { id: manager.id } });
      await prisma.user.delete({ where: { id: cashierWithPin.id } });
    });

    it("rejects a discount over 10% of subtotal with no PIN override", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.ringSale({
          registerSessionId: session.id,
          lines: [{ variantId: variant.id, quantity: 1 }],
          payments: [{ method: "CASH", amountCents: 35000 }],
          discount: { mode: "PERCENT", percent: 30 },
          discountReasonCode: "too_big",
              performedById: null,
        })
      ).rejects.toThrow(/require a manager PIN override/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });

    it("accepts a discount over 10% when a real manager's PIN is supplied", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 35000 }],
        discount: { mode: "PERCENT", percent: 30 },
        discountReasonCode: "manager_approved",
        pinOverride: { approverPin: MANAGER_PIN },
          performedById: null,
      });

      expect(result.order.discountApprovedById).toBe(manager.id);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { entityId: result.order.id, action: "pos.sale.discount" },
      });
      expect(auditEntry.metadata.approvedByUserId).toBe(manager.id);
      expect(auditEntry.metadata.approvedViaPin).toBe(true);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 35000 });
    });

    it("rejects a wrong PIN and writes a pin_denied audit entry", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.ringSale({
          registerSessionId: session.id,
          lines: [{ variantId: variant.id, quantity: 1 }],
          payments: [{ method: "CASH", amountCents: 35000 }],
          discount: { mode: "PERCENT", percent: 30 },
          discountReasonCode: "wrong_pin_attempt",
          pinOverride: { approverPin: "999999" },
              performedById: manager.id,
        })
      ).rejects.toThrow(/Invalid manager PIN/);

      const deniedEntry = await prisma.auditLog.findFirst({
        where: { userId: manager.id, action: "pos.sale.discount.pin_denied" },
        orderBy: { createdAt: "desc" },
      });
      expect(deniedEntry).not.toBeNull();

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });

    it("does not authorize an override using a PIN belonging to a user without approve-reopen permission", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // cashierWithPin's PIN digits deliberately match the manager's, but a
      // cashier doesn't hold pos:register:approve-reopen — the PIN owner's
      // permission must be checked, not just that *some* PIN hash matched.
      await expect(
        posService.ringSale({
          registerSessionId: session.id,
          lines: [{ variantId: variant.id, quantity: 1 }],
          payments: [{ method: "CASH", amountCents: 35000 }],
          discount: { mode: "PERCENT", percent: 30 },
          discountReasonCode: "cashier_pin_attempt",
          pinOverride: { approverPin: CASHIER_PIN },
              performedById: cashierWithPin.id,
        })
      ).rejects.toThrow(/Invalid manager PIN/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });

    it("still enforces the cost floor against the server-resolved percent-based discount", async () => {
      // variant priceCents 50000, costCents unset (null) by default in this
      // fixture — bump cost to a known value for this test only.
      await prisma.variant.update({ where: { id: variant.id }, data: { costCents: 48000 } });
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // 20% of 50000 = 10000 discount -> 40000 total, below the 48000 cost —
      // must be rejected even though the client never sent a cents figure.
      await expect(
        posService.ringSale({
          registerSessionId: session.id,
          lines: [{ variantId: variant.id, quantity: 1 }],
          payments: [{ method: "CASH", amountCents: 40000 }],
          discount: { mode: "PERCENT", percent: 20 },
          discountReasonCode: "manager_approved",
          pinOverride: { approverPin: MANAGER_PIN },
              performedById: null,
        })
      ).rejects.toThrow(/below the cost of the items/);

      await prisma.variant.update({ where: { id: variant.id }, data: { costCents: null } });
      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });
  });

  describe("tax", () => {
    let taxedVariant;

    beforeAll(async () => {
      taxedVariant = await prisma.variant.create({
        data: {
          productId: product.id,
          sku: `TEST-SOFA-TAX-${Date.now()}`,
          name: "Taxed",
          priceCents: 50000,
          taxRatePercent: 8.25,
        },
      });
    });

    afterAll(async () => {
      const orders = await prisma.order.findMany({ where: { lines: { some: { variantId: taxedVariant.id } } } });
      for (const order of orders) {
        await prisma.payment.deleteMany({ where: { orderId: order.id } });
        await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
        await prisma.orderSalesAttribution.deleteMany({ where: { orderId: order.id } });
        await prisma.order.delete({ where: { id: order.id } });
      }
      await prisma.stockMovement.deleteMany({ where: { variantId: taxedVariant.id } });
      await prisma.reservation.deleteMany({ where: { variantId: taxedVariant.id } });
      await prisma.stockBalance.deleteMany({ where: { variantId: taxedVariant.id } });
      await prisma.variant.delete({ where: { id: taxedVariant.id } });
    });

    async function seedTaxedStock(quantity) {
      await prisma.stockBalance.upsert({
        where: { variantId_locationId: { variantId: taxedVariant.id, locationId: location.id } },
        update: { onHand: quantity, reserved: 0 },
        create: { variantId: taxedVariant.id, locationId: location.id, onHand: quantity },
      });
    }

    it("charges the variant's flat tax rate on top of the subtotal, with no discount", async () => {
      await seedTaxedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // 50000 * 8.25% = 4125 tax -> 54125 total.
      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: taxedVariant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 54125 }],
        performedById: null,
      });

      expect(result.order.subtotalCents).toBe(50000);
      expect(result.order.taxCents).toBe(4125);
      expect(result.order.totalCents).toBe(54125);
      expect(result.order.lines[0].taxCents).toBe(4125);
      expect(result.order.lines[0].lineTotalCents).toBe(54125);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 54125 });
    });

    it("computes tax on the discounted (post-discount) amount, not the pre-discount subtotal", async () => {
      await seedTaxedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // 50000 subtotal, 10% discount = 5000 -> taxable 45000, tax = 45000 *
      // 8.25% = 3712.5 -> rounds to 3713. Total = 50000 - 5000 + 3713 = 48713.
      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: taxedVariant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 48713 }],
        discount: { mode: "PERCENT", percent: 10 },
        discountReasonCode: "loyalty_discount",
        performedById: null,
      });

      expect(result.order.discountCents).toBe(5000);
      expect(result.order.taxCents).toBe(3713);
      expect(result.order.totalCents).toBe(48713);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 48713 });
    });

    it("prorates discount across lines by subtotal share before computing each line's tax", async () => {
      await seedTaxedStock(5);
      await seedStock(5); // the zero-tax fixture variant, for a mixed-rate cart
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // Line A (taxed): 50000 @ 8.25%. Line B (zero-tax fixture): 50000 @ 0%.
      // Subtotal 100000, flat $100 discount -> 50/50 split by subtotal share
      // -> each line absorbs 5000 discount. Line A taxable 45000 -> tax 3713
      // (rounds from 3712.5). Line B taxable 45000 @ 0% -> tax 0.
      // Total = 100000 - 10000 + 3713 = 93713.
      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [
          { variantId: taxedVariant.id, quantity: 1 },
          { variantId: variant.id, quantity: 1 },
        ],
        payments: [{ method: "CASH", amountCents: 93713 }],
        discount: { mode: "FLAT_CENTS", amountCents: 10000 },
        discountReasonCode: "manager_price_match",
        performedById: null,
      });

      expect(result.order.taxCents).toBe(3713);
      expect(result.order.totalCents).toBe(93713);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 93713 });
    });
  });

  describe("sales attribution", () => {
    it("defaults to crediting the cashier 100% when no attribution is provided", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
      const cashier = await prisma.user.create({
        data: { email: `pos-attr-default-${Date.now()}@test.local`, passwordHash: "unused", firstName: "Attr", lastName: "Default" },
      });

      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 50000 }],
          performedById: cashier.id,
      });

      const attributions = await prisma.orderSalesAttribution.findMany({ where: { orderId: result.order.id } });
      expect(attributions).toHaveLength(1);
      expect(attributions[0].userId).toBe(cashier.id);
      expect(attributions[0].role).toBe("SALESMAN");
      expect(attributions[0].splitPercent).toBe(100);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 50000 });
      await prisma.orderSalesAttribution.deleteMany({ where: { orderId: result.order.id } });
      await prisma.user.delete({ where: { id: cashier.id } });
    });

    it("persists a two-person split with distinct roles", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
      const salesman = await prisma.user.create({
        data: { email: `pos-attr-sales-${Date.now()}@test.local`, passwordHash: "unused", firstName: "Attr", lastName: "Salesman" },
      });
      const manager2 = await prisma.user.create({
        data: { email: `pos-attr-mgr-${Date.now()}@test.local`, passwordHash: "unused", firstName: "Attr", lastName: "Manager" },
      });

      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 50000 }],
        salesAttribution: [
          { userId: salesman.id, role: "SALESMAN", percent: 60 },
          { userId: manager2.id, role: "MANAGER", percent: 40 },
        ],
          performedById: salesman.id,
      });

      const attributions = await prisma.orderSalesAttribution.findMany({
        where: { orderId: result.order.id },
        orderBy: { splitPercent: "desc" },
      });
      expect(attributions).toHaveLength(2);
      expect(attributions[0]).toMatchObject({ userId: salesman.id, role: "SALESMAN", splitPercent: 60 });
      expect(attributions[1]).toMatchObject({ userId: manager2.id, role: "MANAGER", splitPercent: 40 });

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 50000 });
      await prisma.orderSalesAttribution.deleteMany({ where: { orderId: result.order.id } });
      await prisma.user.delete({ where: { id: salesman.id } });
      await prisma.user.delete({ where: { id: manager2.id } });
    });
  });

  describe("address snapshot", () => {
    it("always rings up a sale as IN_STORE regardless of address capture", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 50000 }],
        performedById: null,
      });

      expect(result.order.fulfillmentMethod).toBe("IN_STORE");
      // A fresh sale lands at RESERVED regardless of payment amount — see
      // ringSale's comment on this line; fulfillment is now advanced
      // manually via PATCH /admin/orders/:id/status, same as online orders.
      expect(result.order.fulfillmentStatus).toBe("RESERVED");

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 50000 });
    });

    it("creates freestanding billing/shipping Address snapshots when a billing address is captured, with billingSameAsShipping", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // Billing is captured first; "same as billing" copies it into shipping.
      const billingAddress = { line1: "1 Test St", city: "Testville", state: "TX", postalCode: "75001" };

      const result = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 50000 }],
        billingAddress,
        billingSameAsShipping: true,
        performedById: null,
      });

      const order = await prisma.order.findUnique({
        where: { id: result.order.id },
        include: { shippingAddress: true, billingAddress: true },
      });
      expect(order.shippingAddress).not.toBeNull();
      expect(order.billingAddress).not.toBeNull();
      expect(order.shippingAddress.id).not.toBe(order.billingAddress.id);
      expect(order.shippingAddress.customerId).toBeNull();
      expect(order.shippingAddress.line1).toBe(billingAddress.line1);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 50000 });
      // Address cleanup for this order happens in the file's main afterAll.
    });
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
        data: { firstName: "Split", lastName: "Payment Test", phone: `555-${Date.now().toString().slice(-7)}`, channel: "POS" },
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

  describe("pending balance settlement", () => {
    async function depositSale({ depositCents }) {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
      // 50000 total, tendered as a deposit only -> PARTIALLY_PAID.
      const sale = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "DEPOSIT", amountCents: depositCents }],
        performedById: null,
      });
      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
      return sale;
    }

    it("finds a PARTIALLY_PAID order by order number, receipt number, or customer phone", async () => {
      const { order, receipt } = await depositSale({ depositCents: 20000 });

      const byOrderNumber = await posService.findOrderWithBalance({ q: order.orderNumber });
      expect(byOrderNumber.order.id).toBe(order.id);
      expect(byOrderNumber.order.paidSoFarCents).toBe(20000);
      expect(byOrderNumber.order.balanceDueCents).toBe(30000);

      const byReceiptNumber = await posService.findOrderWithBalance({ q: receipt.receiptNumber });
      expect(byReceiptNumber.order.id).toBe(order.id);
    });

    it("does not surface an order that's already fully PAID — nothing left to collect", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
      const sale = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 50000 }],
        performedById: null,
      });
      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 50000 });

      await expect(posService.findOrderWithBalance({ q: sale.order.orderNumber })).rejects.toThrow(
        /no order with an outstanding balance/i
      );
    });

    it("collects the remaining balance in full, flips paymentStatus to PAID, and the receipt sums the full payment history", async () => {
      const { order: depositOrder } = await depositSale({ depositCents: 20000 });
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      const result = await posService.settleBalance({
        registerSessionId: session.id,
        orderId: depositOrder.id,
        payments: [{ method: "CASH", amountCents: 30000 }],
        performedById: null,
      });

      expect(result.order.paymentStatus).toBe("PAID");
      expect(result.collectedPayments).toHaveLength(1);
      expect(result.collectedPayments[0].amountCents).toBe(30000);
      // `payments` is the FULL history (original 20000 deposit + this 30000
      // settlement) — ReceiptView.jsx sums this to show total paid, which
      // must equal the full order total once settled, not just this batch.
      expect(result.payments).toHaveLength(2);
      expect(result.payments.reduce((sum, p) => sum + p.amountCents, 0)).toBe(50000);
      expect(result.changeDueCents).toBe(0);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 30000 });
    });

    it("partial settlement of a partial balance stays PARTIALLY_PAID, and a second settlement finishes it", async () => {
      const { order: depositOrder } = await depositSale({ depositCents: 10000 }); // 40000 remaining
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      const first = await posService.settleBalance({
        registerSessionId: session.id,
        orderId: depositOrder.id,
        payments: [{ method: "CASH", amountCents: 15000 }], // 25000 still remaining
        performedById: null,
      });
      expect(first.order.paymentStatus).toBe("PARTIALLY_PAID");
      expect(first.payments.reduce((sum, p) => sum + p.amountCents, 0)).toBe(25000); // 10000 + 15000

      const second = await posService.settleBalance({
        registerSessionId: session.id,
        orderId: depositOrder.id,
        payments: [{ method: "CASH", amountCents: 25000 }],
        performedById: null,
      });
      expect(second.order.paymentStatus).toBe("PAID");
      expect(second.payments.reduce((sum, p) => sum + p.amountCents, 0)).toBe(50000);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 40000 });
    });

    it("records change due when cash overtenders the remaining balance, without recording the overtendered amount", async () => {
      const { order: depositOrder } = await depositSale({ depositCents: 30000 }); // 20000 remaining
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      const result = await posService.settleBalance({
        registerSessionId: session.id,
        orderId: depositOrder.id,
        payments: [{ method: "CASH", amountCents: 25000 }], // 5000 over the 20000 remaining
        performedById: null,
      });

      expect(result.changeDueCents).toBe(5000);
      expect(result.collectedPayments[0].amountCents).toBe(20000); // never 25000
      expect(result.order.paymentStatus).toBe("PAID");

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 20000 });
    });

    it("rejects a non-cash settlement payment that exceeds the remaining balance", async () => {
      const { order: depositOrder } = await depositSale({ depositCents: 30000 }); // 20000 remaining
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.settleBalance({
          registerSessionId: session.id,
          orderId: depositOrder.id,
          payments: [{ method: "DEPOSIT", amountCents: 25000 }], // over the 20000 remaining, and DEPOSIT can't overtender
          performedById: null,
        })
      ).rejects.toThrow(/cannot exceed the remaining balance/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });

    it("rejects CARD as a settlement tender, same as a new sale", async () => {
      const { order: depositOrder } = await depositSale({ depositCents: 20000 });
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      await expect(
        posService.settleBalance({
          registerSessionId: session.id,
          orderId: depositOrder.id,
          payments: [{ method: "CARD", amountCents: 30000 }],
          performedById: null,
        })
      ).rejects.toThrow(/Card-present tender is not available/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 0 });
    });

    it("rejects settling an order that's already fully PAID", async () => {
      await seedStock(5);
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });
      const sale = await posService.ringSale({
        registerSessionId: session.id,
        lines: [{ variantId: variant.id, quantity: 1 }],
        payments: [{ method: "CASH", amountCents: 50000 }],
        performedById: null,
      });

      await expect(
        posService.settleBalance({
          registerSessionId: session.id,
          orderId: sale.order.id,
          payments: [{ method: "CASH", amountCents: 1000 }],
          performedById: null,
        })
      ).rejects.toThrow(/nothing left to collect/);

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 50000 });
    });

    it("never lets two concurrent settlements jointly overcollect beyond the remaining balance", async () => {
      const { order: depositOrder } = await depositSale({ depositCents: 20000 }); // 30000 remaining
      const session = await posService.openRegister({ registerId: register.id, openingCashCents: 0 });

      // Both attempts try to collect the full 30000 remaining at once —
      // only one can win; the loser must see the order as already PAID by
      // the time its own transaction re-reads it, the same row-lock
      // serialization refund() already relies on for the mirror case.
      const results = await Promise.allSettled([
        posService.settleBalance({
          registerSessionId: session.id,
          orderId: depositOrder.id,
          payments: [{ method: "CASH", amountCents: 30000 }],
          performedById: null,
        }),
        posService.settleBalance({
          registerSessionId: session.id,
          orderId: depositOrder.id,
          payments: [{ method: "CASH", amountCents: 30000 }],
          performedById: null,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.message).toMatch(/nothing left to collect|exceeds/i);

      const finalOrder = await prisma.order.findUnique({ where: { id: depositOrder.id } });
      expect(finalOrder.paymentStatus).toBe("PAID");
      const totalPaid = await prisma.payment.aggregate({
        where: { orderId: depositOrder.id, status: "SUCCEEDED" },
        _sum: { amountCents: true },
      });
      expect(totalPaid._sum.amountCents).toBe(50000); // never more than the order total

      await posService.closeRegister({ registerSessionId: session.id, closingCashCents: 30000 });
    });
  });
});
