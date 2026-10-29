const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");
const {
  customerProfileUpdateSchema,
  customerChangePasswordSchema,
  customerAddressSchema,
} = require("@big-eds/validation");
const service = require("./customerAccount.service");
const authService = require("./customerAuth.service");

// Runs against the real dev database (same convention as the other service
// tests — no Prisma mock layer). Every row is tagged with a per-run prefix and
// removed by exact id/prefix in afterAll.
const RUN = Date.now();
const emailPrefix = `customer-account-test-${RUN}`;
const orderPrefix = `TEST-ACCT-${RUN}`;
let counter = 0;
const PASSWORD = "CorrectHorse1!";

async function newCustomer(overrides = {}) {
  counter += 1;
  return prisma.customer.create({
    data: {
      email: `${emailPrefix}-${counter}@example.com`,
      firstName: "Test",
      lastName: "Customer",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      emailVerifiedAt: new Date(),
      ...overrides,
    },
  });
}

const ADDRESS = { line1: "1 Main St", city: "Springfield", state: "IL", postalCode: "62701" };

afterAll(async () => {
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: orderPrefix } } });
  // Addresses go with the customer (cascade).
  await prisma.customer.deleteMany({ where: { email: { startsWith: emailPrefix } } });
});

describe("customerAccount.service — profile", () => {
  it("returns the profile and updates names and phone", async () => {
    const customer = await newCustomer();

    expect(await service.getProfile(customer.id)).toMatchObject({
      email: customer.email,
      firstName: "Test",
      phone: null,
    });

    const updated = await service.updateProfile(customer.id, { firstName: "Jane", lastName: "Doe", phone: "555-123-4567" });
    expect(updated).toMatchObject({ firstName: "Jane", lastName: "Doe", phone: "555-123-4567" });
    expect(updated).not.toHaveProperty("passwordHash");
  });

  it("leaves the phone alone when it isn't sent, and clears it when sent as null", async () => {
    const customer = await newCustomer({ phone: "555-000-1111" });

    const kept = await service.updateProfile(customer.id, { firstName: "A", lastName: "B" });
    expect(kept.phone).toBe("555-000-1111");

    const cleared = await service.updateProfile(customer.id, { firstName: "A", lastName: "B", phone: null });
    expect(cleared.phone).toBeNull();
  });

  it("never changes the email", async () => {
    const customer = await newCustomer();
    const updated = await service.updateProfile(customer.id, {
      firstName: "A",
      lastName: "B",
      email: "attacker@example.com",
    });
    expect(updated.email).toBe(customer.email);
  });
});

describe("customerAccount.service — change password", () => {
  it("rejects a wrong current password with 400 (not 401) and changes nothing", async () => {
    const customer = await newCustomer();

    await expect(
      service.changePassword(customer.id, { currentPassword: "not-the-password", newPassword: "BrandNewPass9!" })
    ).rejects.toMatchObject({ statusCode: 400, details: { reason: "incorrect_password" } });

    const signedIn = await authService.loginCustomer({ email: customer.email, password: PASSWORD });
    expect(signedIn.id).toBe(customer.id);
  });

  it("with the right current password, the new one works for sign-in and the old one stops", async () => {
    const customer = await newCustomer();
    await service.changePassword(customer.id, { currentPassword: PASSWORD, newPassword: "BrandNewPass9!" });

    const signedIn = await authService.loginCustomer({ email: customer.email, password: "BrandNewPass9!" });
    expect(signedIn.id).toBe(customer.id);
    await expect(authService.loginCustomer({ email: customer.email, password: PASSWORD })).rejects.toMatchObject({
      statusCode: 401,
    });

    const stored = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(stored.passwordHash).not.toContain("BrandNewPass9!");
  });
});

describe("customerAccount.service — addresses", () => {
  it("the first address becomes the default, later ones don't", async () => {
    const customer = await newCustomer();

    const first = await service.createAddress(customer.id, ADDRESS);
    const second = await service.createAddress(customer.id, { ...ADDRESS, line1: "2 Oak Ave" });

    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
    const list = await service.listAddresses(customer.id);
    expect(list.map((a) => a.id)).toEqual([first.id, second.id]);
  });

  it("creating with isDefault moves the default, keeping exactly one", async () => {
    const customer = await newCustomer();
    const first = await service.createAddress(customer.id, ADDRESS);
    const second = await service.createAddress(customer.id, { ...ADDRESS, line1: "2 Oak Ave", isDefault: true });

    const list = await service.listAddresses(customer.id);
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    expect(list[0].id).toBe(second.id);
    expect(list.find((a) => a.id === first.id).isDefault).toBe(false);
  });

  it("edits an address, and setDefaultAddress flips the default", async () => {
    const customer = await newCustomer();
    const first = await service.createAddress(customer.id, ADDRESS);
    const second = await service.createAddress(customer.id, { ...ADDRESS, line1: "2 Oak Ave" });

    const edited = await service.updateAddress(customer.id, second.id, { city: "Shelbyville", line2: "Apt 4" });
    expect(edited).toMatchObject({ city: "Shelbyville", line2: "Apt 4", line1: "2 Oak Ave", isDefault: false });

    const list = await service.setDefaultAddress(customer.id, second.id);
    expect(list[0].id).toBe(second.id);
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    expect(list.find((a) => a.id === first.id).isDefault).toBe(false);
  });

  it("unticking default on the current default is ignored (a default always exists)", async () => {
    const customer = await newCustomer();
    const only = await service.createAddress(customer.id, ADDRESS);

    const edited = await service.updateAddress(customer.id, only.id, { isDefault: false });
    expect(edited.isDefault).toBe(true);
  });

  it("deleting the default promotes the oldest remaining address", async () => {
    const customer = await newCustomer();
    const first = await service.createAddress(customer.id, ADDRESS);
    const second = await service.createAddress(customer.id, { ...ADDRESS, line1: "2 Oak Ave" });
    const third = await service.createAddress(customer.id, { ...ADDRESS, line1: "3 Elm Rd" });

    const list = await service.deleteAddress(customer.id, first.id);

    expect(list.map((a) => a.id)).toEqual([second.id, third.id]);
    expect(list[0].isDefault).toBe(true);
    expect(list[1].isDefault).toBe(false);
  });

  it("deleting the last address leaves an empty list", async () => {
    const customer = await newCustomer();
    const only = await service.createAddress(customer.id, ADDRESS);
    expect(await service.deleteAddress(customer.id, only.id)).toEqual([]);
  });

  it("a customer cannot read, edit, default or delete another customer's address", async () => {
    const owner = await newCustomer();
    const intruder = await newCustomer();
    const address = await service.createAddress(owner.id, ADDRESS);

    expect(await service.listAddresses(intruder.id)).toEqual([]);
    await expect(service.updateAddress(intruder.id, address.id, { city: "Hacked" })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.setDefaultAddress(intruder.id, address.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deleteAddress(intruder.id, address.id)).rejects.toMatchObject({ statusCode: 404 });

    const [still] = await service.listAddresses(owner.id);
    expect(still).toMatchObject({ id: address.id, city: "Springfield" });
  });

  it("caps how many addresses one customer can save", async () => {
    const customer = await newCustomer();
    for (let i = 0; i < service.MAX_ADDRESSES; i += 1) {
      await service.createAddress(customer.id, { ...ADDRESS, line1: `${i + 1} Main St` });
    }
    await expect(service.createAddress(customer.id, ADDRESS)).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "address_limit" },
    });
  });
});

describe("customerAccount.service — orders", () => {
  let variant;
  beforeAll(async () => {
    variant = await prisma.variant.findFirst();
  });

  const makeOrder = (customerId, suffix, overrides = {}) =>
    prisma.order.create({
      data: {
        orderNumber: `${orderPrefix}-${suffix}`,
        channel: "ONLINE",
        customerId,
        status: "CONFIRMED",
        subtotalCents: 12345,
        totalCents: 12345,
        ...overrides,
      },
    });

  it("lists only the customer's own non-draft orders, newest first", async () => {
    const mine = await newCustomer();
    const other = await newCustomer();
    const older = await makeOrder(mine.id, "A", { createdAt: new Date(Date.now() - 60_000) });
    const newer = await makeOrder(mine.id, "B");
    await makeOrder(mine.id, "C", { status: "DRAFT" });
    await makeOrder(other.id, "D");

    const { orders, pagination } = await service.listOrders(mine.id);

    expect(orders.map((o) => o.id)).toEqual([newer.id, older.id]);
    expect(pagination).toMatchObject({ page: 1, total: 2 });
    expect(orders[0]).toMatchObject({ totalCents: 12345, status: "CONFIRMED", paymentStatus: "UNPAID" });
  });

  it("pages through orders", async () => {
    const customer = await newCustomer();
    for (let i = 0; i < 3; i += 1) {
      await makeOrder(customer.id, `P${i}`, { createdAt: new Date(Date.now() - i * 1000) });
    }

    const first = await service.listOrders(customer.id, { page: 1, pageSize: 2 });
    const second = await service.listOrders(customer.id, { page: 2, pageSize: 2 });

    expect(first.orders).toHaveLength(2);
    expect(second.orders).toHaveLength(1);
    expect(first.pagination.total).toBe(3);
    expect(new Set([...first.orders, ...second.orders].map((o) => o.id)).size).toBe(3);
  });

  it("includes line snapshots when the order has lines", async () => {
    expect(variant, "needs at least one catalog variant to attach an order line to").toBeTruthy();
    const customer = await newCustomer();
    const order = await makeOrder(customer.id, "L", {
      lines: {
        create: {
          variantId: variant.id,
          skuSnapshot: "SNAP-SKU",
          nameSnapshot: "Snapshot Sofa — Grey",
          quantity: 2,
          unitPriceCents: 5000,
          lineTotalCents: 10000,
        },
      },
    });

    const { orders } = await service.listOrders(customer.id);

    expect(orders[0].id).toBe(order.id);
    expect(orders[0].lines).toEqual([
      expect.objectContaining({ name: "Snapshot Sofa — Grey", sku: "SNAP-SKU", quantity: 2, lineTotalCents: 10000 }),
    ]);
  });
});

describe("customer account validation schemas", () => {
  it("profile: trims names, normalises blank phone to null, rejects junk phones", () => {
    expect(customerProfileUpdateSchema.parse({ firstName: "  Jane ", lastName: "Doe", phone: "" })).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      phone: null,
    });
    expect(customerProfileUpdateSchema.safeParse({ firstName: "J", lastName: "D", phone: "abc" }).success).toBe(false);
    expect(customerProfileUpdateSchema.safeParse({ firstName: "J", lastName: "D", phone: "12" }).success).toBe(false);
    expect(customerProfileUpdateSchema.safeParse({ firstName: "", lastName: "D" }).success).toBe(false);
  });

  it("change password: new password must be valid and different from the current one", () => {
    expect(customerChangePasswordSchema.safeParse({ currentPassword: "oldpassword1", newPassword: "newpassword1" }).success).toBe(true);
    expect(customerChangePasswordSchema.safeParse({ currentPassword: "oldpassword1", newPassword: "short" }).success).toBe(false);
    expect(customerChangePasswordSchema.safeParse({ currentPassword: "samepassword1", newPassword: "samepassword1" }).success).toBe(false);
  });

  it("address: requires street, city, state and postal code; blank line2 becomes null", () => {
    expect(customerAddressSchema.parse({ ...ADDRESS, line2: "" }).line2).toBeNull();
    expect(customerAddressSchema.safeParse({ ...ADDRESS, city: "" }).success).toBe(false);
    expect(customerAddressSchema.safeParse({ line1: "x" }).success).toBe(false);
  });
});
