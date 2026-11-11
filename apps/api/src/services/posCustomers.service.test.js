const { prisma } = require("@big-eds/database");
const posCustomersService = require("./posCustomers.service");

describe("posCustomers.service", () => {
  const stamp = Date.now();
  const createdCustomerIds = [];

  afterAll(async () => {
    await prisma.address.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.$disconnect();
  });

  it("creates a guest customer (no passwordHash/emailVerifiedAt) findable by name, phone, and email", async () => {
    const customer = await posCustomersService.createPosCustomer({
      firstName: "Pat",
      lastName: `Guestline${stamp}`,
      phone: `555-${stamp.toString().slice(-7)}`,
      email: `pos-guest-${stamp}@example.com`,
    });
    createdCustomerIds.push(customer.id);

    const row = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(row.passwordHash).toBeNull();
    expect(row.emailVerifiedAt).toBeNull();

    const byName = await posCustomersService.searchCustomersForPos({ q: `Guestline${stamp}` });
    expect(byName.some((c) => c.id === customer.id)).toBe(true);

    const byPhone = await posCustomersService.searchCustomersForPos({ q: customer.phone });
    expect(byPhone.some((c) => c.id === customer.id)).toBe(true);

    const byEmail = await posCustomersService.searchCustomersForPos({ q: customer.email });
    expect(byEmail.some((c) => c.id === customer.id)).toBe(true);
  });

  it("creates a customer without an email (optional field)", async () => {
    const customer = await posCustomersService.createPosCustomer({
      firstName: "NoEmail",
      lastName: `Customer${stamp}`,
      phone: `555-${(stamp + 1).toString().slice(-7)}`,
      email: undefined,
    });
    createdCustomerIds.push(customer.id);
    expect(customer.email).toBeNull();
  });

  it("upserts by email instead of creating a duplicate row for a repeat email", async () => {
    const email = `pos-upsert-${stamp}@example.com`;
    const first = await posCustomersService.createPosCustomer({
      firstName: "First",
      lastName: "Visit",
      phone: `555-${(stamp + 2).toString().slice(-7)}`,
      email,
    });
    createdCustomerIds.push(first.id);

    const second = await posCustomersService.createPosCustomer({
      firstName: "Updated",
      lastName: "Name",
      phone: `555-${(stamp + 3).toString().slice(-7)}`,
      email,
    });

    expect(second.id).toBe(first.id);
    expect(second.firstName).toBe("Updated");

    const count = await prisma.customer.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("creates an address row when address fields are provided", async () => {
    const customer = await posCustomersService.createPosCustomer({
      firstName: "Addr",
      lastName: `Test${stamp}`,
      phone: `555-${(stamp + 4).toString().slice(-7)}`,
      address: { line1: "123 Main St", city: "Springfield", state: "IL", postalCode: "62704" },
    });
    createdCustomerIds.push(customer.id);

    const addresses = await prisma.address.findMany({ where: { customerId: customer.id } });
    expect(addresses).toHaveLength(1);
    expect(addresses[0].city).toBe("Springfield");
    expect(addresses[0].isDefault).toBe(true);
  });
});
