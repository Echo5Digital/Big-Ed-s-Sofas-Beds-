const { prisma } = require("@big-eds/database");

// Safety net for test fixtures that survive an interrupted test run (killed
// process, crashed run, a background job cut off mid-afterAll) and are left
// sitting in the shared dev database — which, unlike a real isolated test DB,
// is the same database the storefront's public catalog API reads from. A
// leaked fixture here isn't just test pollution, it's a "Test Sofa" showing
// up for real customers. Every test file in this repo already names its
// fixtures with the literal word "Test" (POS Test Category, Returns Test
// Sofa, reports-test-${Date.now()}@example.com, etc. — grep the test suite,
// it's completely consistent and no real catalog/user data is ever named
// this way), so that naming convention is used here as the sweep's only
// signal: delete anything matching it before a fresh test run starts,
// regardless of whether a PRIOR run's own afterAll ever got to execute.
//
// Fully removes every order matching `where` — same cleanup order every
// test file's own afterAll already uses (return/refund/payment rows before
// lines, address FKs cleared before the address rows they point to), so an
// order is always deleted as a whole, never left half-gone. Shared by both
// sweep passes below: the first finds leaked orders by their own
// product/customer naming, the second catches any order a leaked Variant is
// still attached to that the first pass's query didn't happen to match.
async function deleteOrdersMatching(where) {
  const orders = await prisma.order.findMany({
    where,
    select: { id: true, shippingAddressId: true, billingAddressId: true },
  });
  const orderIds = orders.map((o) => o.id);
  const addressIds = orders.flatMap((o) => [o.shippingAddressId, o.billingAddressId]).filter(Boolean);

  if (orderIds.length) {
    await prisma.returnLine.deleteMany({ where: { returnTransaction: { orderId: { in: orderIds } } } });
    await prisma.returnTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderLine.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderSalesAttribution.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.statusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.receipt.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.pickup.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.reservation.deleteMany({ where: { orderId: { in: orderIds } } });
    // Clear the address FKs before deleting the orders so SetNull isn't
    // racing the order delete, then delete the now-orphaned snapshot rows.
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { shippingAddressId: null, billingAddressId: null, deliveryAddressId: null },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (addressIds.length) {
    await prisma.address.deleteMany({ where: { id: { in: addressIds } } });
  }
}

// Run automatically via vitest.config.mjs's globalSetup — see there for why
// this must run once per test-run, not per file/test.
async function sweepLeakedTestFixtures() {
  await deleteOrdersMatching({
    OR: [
      { lines: { some: { variant: { product: { name: { contains: "Test", mode: "insensitive" } } } } } },
      { customer: { email: { contains: "test", mode: "insensitive" } } },
    ],
  });

  const variants = await prisma.variant.findMany({
    where: { product: { name: { contains: "Test", mode: "insensitive" } } },
    select: { id: true, productId: true },
  });
  const variantIds = variants.map((v) => v.id);
  const productIds = [...new Set(variants.map((v) => v.productId))];

  if (variantIds.length) {
    // Defense in depth beyond the sweep above: that pass only matched
    // orders whose line variant/product already said "Test" AT THE TIME
    // ITS OWN QUERY RAN — an order line can still reference one of these
    // variants if that query's result went stale (e.g. two sweep/test runs
    // overlapping against this DB, observed once after running concurrent
    // background test invocations). OrderLine.variantId's Restrict FK would
    // otherwise block the Variant delete below.
    await deleteOrdersMatching({ lines: { some: { variantId: { in: variantIds } } } });

    await prisma.priceHistory.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.reservation.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.stockBalance.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.variant.deleteMany({ where: { id: { in: variantIds } } });
  }

  const products = await prisma.product.findMany({
    where: { name: { contains: "Test", mode: "insensitive" } },
    select: { id: true },
  });
  const allProductIds = [...new Set([...productIds, ...products.map((p) => p.id)])];
  if (allProductIds.length) {
    await prisma.productLink.deleteMany({
      where: { OR: [{ productId: { in: allProductIds } }, { linkedProductId: { in: allProductIds } }] },
    });
    await prisma.productCategory.deleteMany({ where: { productId: { in: allProductIds } } });
    await prisma.productImage.deleteMany({ where: { productId: { in: allProductIds } } });
    await prisma.productVideo.deleteMany({ where: { productId: { in: allProductIds } } });
    await prisma.review.deleteMany({ where: { productId: { in: allProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: allProductIds } } });
  }

  await prisma.productCategory.deleteMany({
    where: { category: { name: { contains: "Test", mode: "insensitive" } } },
  });
  await prisma.category.updateMany({
    where: { parent: { name: { contains: "Test", mode: "insensitive" } } },
    data: { parentId: null },
  });
  await prisma.category.deleteMany({ where: { name: { contains: "Test", mode: "insensitive" } } });

  const registers = await prisma.register.findMany({
    where: { name: { contains: "Test", mode: "insensitive" } },
    select: { id: true },
  });
  const registerIds = registers.map((r) => r.id);
  if (registerIds.length) {
    const sessions = await prisma.registerSession.findMany({
      where: { registerId: { in: registerIds } },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length) {
      await prisma.cashMovement.deleteMany({ where: { registerSessionId: { in: sessionIds } } });
      await prisma.receipt.deleteMany({ where: { registerSessionId: { in: sessionIds } } });
      await prisma.returnTransaction.deleteMany({ where: { registerSessionId: { in: sessionIds } } });
      await prisma.payment.deleteMany({ where: { registerSessionId: { in: sessionIds } } });
    }
    await prisma.registerSession.deleteMany({ where: { registerId: { in: registerIds } } });
    await prisma.register.deleteMany({ where: { id: { in: registerIds } } });
  }

  const locations = await prisma.location.findMany({
    where: { name: { contains: "Test", mode: "insensitive" } },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);
  if (locationIds.length) {
    // Restrict FKs into Location — same class of bug as the Variant/OrderLine
    // gap above. StockBalance is Cascade (safe on its own) but is cleaned up
    // here anyway since its unique(variantId, locationId) index would otherwise
    // leave a dangling-looking row once the location is gone.
    await prisma.stockMovement.deleteMany({ where: { locationId: { in: locationIds } } });
    await prisma.reservation.deleteMany({ where: { locationId: { in: locationIds } } });
    await prisma.stockBalance.deleteMany({ where: { locationId: { in: locationIds } } });
    await prisma.transfer.deleteMany({
      where: { OR: [{ fromLocationId: { in: locationIds } }, { toLocationId: { in: locationIds } }] },
    });
    await prisma.receiptLine.deleteMany({ where: { goodsReceipt: { locationId: { in: locationIds } } } });
    await prisma.goodsReceipt.deleteMany({ where: { locationId: { in: locationIds } } });
    await prisma.count.deleteMany({ where: { locationId: { in: locationIds } } });
    await prisma.register.updateMany({ where: { locationId: { in: locationIds } }, data: { locationId: null } });
    await prisma.location.deleteMany({ where: { id: { in: locationIds } } });
  }

  // Test users (every fixture in the suite uses an @test.local or @example.com
  // address with "test" in the local-part) — clear what they're attributed to
  // first so the FK Restrict on OrderSalesAttribution.userId doesn't block it.
  const users = await prisma.user.findMany({
    where: { email: { contains: "test", mode: "insensitive" } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length) {
    await prisma.orderSalesAttribution.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.order.updateMany({
      where: { discountApprovedById: { in: userIds } },
      data: { discountApprovedById: null },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Matches by email OR name — some fixtures (e.g. pos.service.test.js's
  // split-payment tests) create customers with no email at all, only a name
  // like "Split Payment Test", so an email-only match misses them.
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { email: { contains: "test", mode: "insensitive" } },
        { firstName: { contains: "test", mode: "insensitive" } },
        { lastName: { contains: "test", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);
  if (customerIds.length) {
    await prisma.storeCredit.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.address.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  }
}

module.exports = { sweepLeakedTestFixtures };
