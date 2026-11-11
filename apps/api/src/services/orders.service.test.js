const { prisma } = require("@big-eds/database");
const { saveCheckoutDeliveryAddress } = require("./orders.service");

// Runs against the real dev database (same convention as customers.service.test.js —
// no Prisma mock layer).
describe("orders.service — saveCheckoutDeliveryAddress", () => {
  const RUN = Date.now();
  let customer;

  beforeAll(async () => {
    customer = await prisma.customer.create({
      data: { email: `orders-service-test-${RUN}@example.com`, firstName: "Ord", lastName: "Tester" },
    });
  });

  afterAll(async () => {
    await prisma.address.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  });

  it("returns null and creates nothing when no address was submitted", async () => {
    const result = await saveCheckoutDeliveryAddress(customer.id, null);
    expect(result).toBeNull();
    expect(await prisma.address.count({ where: { customerId: customer.id } })).toBe(0);
  });

  it("creates an Address row linked to the customer, as the first (default) address", async () => {
    const result = await saveCheckoutDeliveryAddress(customer.id, {
      line1: "1 Checkout Way",
      line2: "Unit 2",
      city: "Lake Wales",
      state: "FL",
      postalCode: "33853",
    });

    expect(result.customerId).toBe(customer.id);
    expect(result.type).toBe("SHIPPING");
    expect(result.isDefault).toBe(true);

    const stored = await prisma.address.findUnique({ where: { id: result.id } });
    expect(stored).toMatchObject({
      customerId: customer.id,
      line1: "1 Checkout Way",
      line2: "Unit 2",
      city: "Lake Wales",
      state: "FL",
      postalCode: "33853",
    });
  });

  it("does not steal default from an existing default address on a later checkout", async () => {
    const second = await saveCheckoutDeliveryAddress(customer.id, {
      line1: "2 Second St",
      city: "Kissimmee",
      state: "FL",
      postalCode: "34741",
    });

    expect(second.isDefault).toBe(false);
    const defaults = await prisma.address.findMany({ where: { customerId: customer.id, isDefault: true } });
    expect(defaults).toHaveLength(1);
    expect(defaults[0].line1).toBe("1 Checkout Way");
  });
});
