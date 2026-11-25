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
    expect(byName.customers.some((c) => c.id === customer.id)).toBe(true);
    expect(byName.total).toBeGreaterThanOrEqual(1);

    const byPhone = await posCustomersService.searchCustomersForPos({ q: customer.phone });
    expect(byPhone.customers.some((c) => c.id === customer.id)).toBe(true);

    const byEmail = await posCustomersService.searchCustomersForPos({ q: customer.email });
    expect(byEmail.customers.some((c) => c.id === customer.id)).toBe(true);
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
    // Billing, not shipping — this is the walk-in customer's own address for
    // their record, not a delivery destination (see createPosCustomer).
    expect(addresses[0].type).toBe("BILLING");
  });

  it("returns the new address inline on the created customer (so the checkout screen can prefill without a second round-trip)", async () => {
    const customer = await posCustomersService.createPosCustomer({
      firstName: "Inline",
      lastName: `Addr${stamp}`,
      phone: `555-${(stamp + 5).toString().slice(-7)}`,
      address: { line1: "456 Oak Ave", city: "Rivertown", state: "OH", postalCode: "43215" },
    });
    createdCustomerIds.push(customer.id);

    expect(customer.address).toEqual({
      line1: "456 Oak Ave",
      line2: "",
      city: "Rivertown",
      state: "OH",
      postalCode: "43215",
    });
  });

  it("returns address: null when no address was ever saved", async () => {
    const customer = await posCustomersService.createPosCustomer({
      firstName: "NoAddr",
      lastName: `Customer${stamp}`,
      phone: `555-${(stamp + 6).toString().slice(-7)}`,
    });
    createdCustomerIds.push(customer.id);

    expect(customer.address).toBeNull();
  });

  it("surfaces a repeat walk-in's address on file even when this visit's call sends no address", async () => {
    const email = `pos-repeat-${stamp}@example.com`;
    const first = await posCustomersService.createPosCustomer({
      firstName: "Repeat",
      lastName: "Visitor",
      phone: `555-${(stamp + 7).toString().slice(-7)}`,
      email,
      address: { line1: "789 Pine Rd", city: "Lakeview", state: "MI", postalCode: "48001" },
    });
    createdCustomerIds.push(first.id);

    const second = await posCustomersService.createPosCustomer({
      firstName: "Repeat",
      lastName: "Visitor",
      phone: first.phone,
      email,
    });

    expect(second.id).toBe(first.id);
    expect(second.address).toEqual({
      line1: "789 Pine Rd",
      line2: "",
      city: "Lakeview",
      state: "MI",
      postalCode: "48001",
    });
  });

  it("replaces the prior default address instead of leaving two defaults when a repeat walk-in gives a new one", async () => {
    const email = `pos-readdr-${stamp}@example.com`;
    const first = await posCustomersService.createPosCustomer({
      firstName: "Moved",
      lastName: "Customer",
      phone: `555-${(stamp + 8).toString().slice(-7)}`,
      email,
      address: { line1: "1 Old St", city: "Oldtown", state: "OH", postalCode: "43000" },
    });
    createdCustomerIds.push(first.id);

    const second = await posCustomersService.createPosCustomer({
      firstName: "Moved",
      lastName: "Customer",
      phone: first.phone,
      email,
      address: { line1: "2 New St", city: "Newtown", state: "OH", postalCode: "43001" },
    });

    expect(second.address.line1).toBe("2 New St");
    const defaults = await prisma.address.findMany({ where: { customerId: first.id, isDefault: true } });
    expect(defaults).toHaveLength(1);
    expect(defaults[0].line1).toBe("2 New St");
  });

  it("reuses the existing address instead of creating a duplicate row when a repeat walk-in gives the same one again", async () => {
    const email = `pos-samereaddr-${stamp}@example.com`;
    const first = await posCustomersService.createPosCustomer({
      firstName: "Same",
      lastName: "Address",
      phone: `555-${(stamp + 10).toString().slice(-7)}`,
      email,
      address: { line1: "1 Repeat St", city: "Sameville", state: "OH", postalCode: "43002" },
    });
    createdCustomerIds.push(first.id);

    const second = await posCustomersService.createPosCustomer({
      firstName: "Same",
      lastName: "Address",
      phone: first.phone,
      email,
      address: { line1: "  1 repeat st  ", city: "SAMEVILLE", state: "oh", postalCode: "43002" },
    });

    expect(second.address.line1).toBe("1 Repeat St");
    const addresses = await prisma.address.findMany({ where: { customerId: first.id } });
    expect(addresses).toHaveLength(1);
    expect(addresses[0].isDefault).toBe(true);
  });

  it("includes address on search results via the default-address include", async () => {
    const customer = await posCustomersService.createPosCustomer({
      firstName: "Searchable",
      lastName: `WithAddr${stamp}`,
      phone: `555-${(stamp + 9).toString().slice(-7)}`,
      address: { line1: "99 Search Ln", city: "Findville", state: "TX", postalCode: "75000" },
    });
    createdCustomerIds.push(customer.id);

    const { customers } = await posCustomersService.searchCustomersForPos({ q: `WithAddr${stamp}` });
    const found = customers.find((c) => c.id === customer.id);
    expect(found).toBeDefined();
    expect(found.address).toEqual({
      line1: "99 Search Ln",
      line2: "",
      city: "Findville",
      state: "TX",
      postalCode: "75000",
    });
  });
});
