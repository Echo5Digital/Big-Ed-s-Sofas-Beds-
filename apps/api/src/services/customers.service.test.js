const { prisma } = require("@big-eds/database");
const { listCustomers, deleteRegisteredCustomer } = require("./customers.service");

// Runs against the real dev database (same convention as pos.service.test.js —
// no Prisma mock layer). Every row uses a run-unique surname/email prefix so
// assertions only ever look at this run's data, whatever else the database
// holds, and afterAll removes exactly what was created.
const RUN = Date.now();
const SURNAME = `Zephyr${RUN}`;
const emailPrefix = `customer-list-test-${RUN}`;

describe("customers.service — listCustomers", () => {
  const created = {};

  beforeAll(async () => {
    const earlier = new Date(Date.now() - 60 * 60 * 1000);
    const later = new Date(Date.now() - 60 * 1000);

    created.alice = await prisma.customer.create({
      data: {
        email: `${emailPrefix}-alice@example.com`,
        firstName: "Alice",
        lastName: SURNAME,
        phone: "555-0101",
        passwordHash: "x",
        emailVerifiedAt: earlier,
        channel: "ONLINE",
      },
    });
    created.bob = await prisma.customer.create({
      data: {
        email: `${emailPrefix}-bob@example.com`,
        firstName: "Bob",
        lastName: SURNAME,
        passwordHash: "x",
        emailVerifiedAt: later,
        channel: "ONLINE",
      },
    });
    // A guest from online checkout: has an order trail but never registered.
    created.guest = await prisma.customer.create({
      data: { email: `${emailPrefix}-guest@example.com`, firstName: "Gina", lastName: SURNAME, channel: "ONLINE" },
    });
    // Defensive: a password without a verified email must not count as registered.
    created.unverified = await prisma.customer.create({
      data: { email: `${emailPrefix}-unverified@example.com`, firstName: "Una", lastName: SURNAME, passwordHash: "x", channel: "ONLINE" },
    });
    // A POS-channel customer sharing the exact same (unqualified) email
    // local-part style as the others, to prove channel scoping/filtering
    // actually separates them rather than merging by name/search match.
    created.posWalkIn = await prisma.customer.create({
      data: { email: `${emailPrefix}-pos@example.com`, firstName: "Pat", lastName: SURNAME, channel: "POS" },
    });
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  });

  it("lists every customer regardless of channel by default", async () => {
    const { customers, pagination } = await listCustomers({ q: SURNAME });

    expect(customers.map((c) => c.email).sort()).toEqual(
      [
        `${emailPrefix}-alice@example.com`,
        `${emailPrefix}-bob@example.com`,
        `${emailPrefix}-guest@example.com`,
        `${emailPrefix}-unverified@example.com`,
        `${emailPrefix}-pos@example.com`,
      ].sort()
    );
    expect(pagination.total).toBe(5);
  });

  it("narrows to one channel when asked", async () => {
    const online = await listCustomers({ q: SURNAME, channel: "ONLINE" });
    expect(online.customers.map((c) => c.email).sort()).toEqual(
      [
        `${emailPrefix}-alice@example.com`,
        `${emailPrefix}-bob@example.com`,
        `${emailPrefix}-guest@example.com`,
        `${emailPrefix}-unverified@example.com`,
      ].sort()
    );

    const pos = await listCustomers({ q: SURNAME, channel: "POS" });
    expect(pos.customers.map((c) => c.email)).toEqual([`${emailPrefix}-pos@example.com`]);
  });

  it("tags each row with registeredAt only when it actually has verified credentials", async () => {
    const { customers } = await listCustomers({ q: SURNAME });
    const byName = Object.fromEntries(customers.map((c) => [c.firstName, c]));

    expect(byName.Alice.registeredAt).not.toBeNull();
    expect(byName.Bob.registeredAt).not.toBeNull();
    expect(byName.Gina.registeredAt).toBeNull();
    expect(byName.Una.registeredAt).toBeNull();
    expect(byName.Pat.registeredAt).toBeNull();
    expect(byName.Pat.channel).toBe("POS");
    expect(byName.Alice.channel).toBe("ONLINE");
  });

  it("never exposes credentials, only the intended public fields", async () => {
    const { customers } = await listCustomers({ q: SURNAME });

    for (const customer of customers) {
      expect(Object.keys(customer).sort()).toEqual(
        [
          "address",
          "averageOrderValueCents",
          "channel",
          "email",
          "firstName",
          "id",
          "lastName",
          "orderCount",
          "phone",
          "registeredAt",
          "totalSpendCents",
        ].sort()
      );
    }
    expect(JSON.stringify(customers)).not.toMatch(/passwordHash|"x"/);
  });

  it("shows each customer's registration date, order count, spend, and address", async () => {
    // Order numbers are count-based, so on a shared database the order exists
    // only for the instant it's needed and is removed in `finally`.
    const order = await prisma.order.create({
      data: { orderNumber: `CUSTOMER-LIST-TEST-${RUN}`, channel: "ONLINE", customerId: created.alice.id, totalCents: 5000 },
    });
    const canceledOrder = await prisma.order.create({
      data: {
        orderNumber: `CUSTOMER-LIST-TEST-${RUN}-CANCELED`,
        channel: "ONLINE",
        customerId: created.alice.id,
        totalCents: 9999,
        status: "CANCELED",
      },
    });
    const address = await prisma.address.create({
      data: { customerId: created.alice.id, type: "SHIPPING", line1: "1 Test St", city: "Lake Wales", state: "FL", postalCode: "33853" },
    });

    try {
      const { customers } = await listCustomers({ q: SURNAME });
      const alice = customers.find((c) => c.firstName === "Alice");
      const bob = customers.find((c) => c.firstName === "Bob");

      expect(alice.orderCount).toBe(1);
      expect(alice.totalSpendCents).toBe(5000);
      expect(alice.averageOrderValueCents).toBe(5000);
      expect(alice.phone).toBe("555-0101");
      expect(alice.address).toMatchObject({ line1: "1 Test St", city: "Lake Wales", state: "FL", postalCode: "33853" });
      expect(bob.orderCount).toBe(0);
      expect(bob.totalSpendCents).toBe(0);
      expect(bob.averageOrderValueCents).toBe(0);
      expect(bob.address).toBeNull();
      expect(new Date(alice.registeredAt).getTime()).toBe(created.alice.emailVerifiedAt.getTime());
    } finally {
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.order.delete({ where: { id: canceledOrder.id } });
      await prisma.address.delete({ where: { id: address.id } });
    }
  });

  it("puts the most recently created customer first", async () => {
    const { customers } = await listCustomers({ q: SURNAME });
    // created in order alice, bob, guest, unverified, posWalkIn — newest first.
    expect(customers.map((c) => c.firstName)).toEqual(["Pat", "Una", "Gina", "Bob", "Alice"]);
  });

  it("searches case-insensitively across name and email, requiring every term to match", async () => {
    const byFullName = await listCustomers({ q: `alice ${SURNAME.toUpperCase()}` });
    expect(byFullName.customers.map((c) => c.firstName)).toEqual(["Alice"]);

    const byEmail = await listCustomers({ q: `${emailPrefix}-bob` });
    expect(byEmail.customers.map((c) => c.firstName)).toEqual(["Bob"]);

    // Phone is shown but deliberately not searchable — someone who changes or
    // removes their number shouldn't stay findable by the old one.
    const byPhone = await listCustomers({ q: "555-0101" });
    expect(byPhone.customers.some((c) => c.firstName === "Alice")).toBe(false);

    const noMatch = await listCustomers({ q: `alice nobody${RUN}` });
    expect(noMatch.customers).toEqual([]);
    expect(noMatch.pagination.total).toBe(0);
  });

  it("does not treat SQL wildcards in the search as wildcards", async () => {
    const { customers } = await listCustomers({ q: `%${SURNAME}%_` });
    expect(customers).toEqual([]);
  });

  it("pages stably and reports the total", async () => {
    // Scoped to ONLINE so the total (4: alice, bob, guest, unverified) is
    // exact and independent of the POS fixture above.
    const first = await listCustomers({ q: SURNAME, channel: "ONLINE", page: 1, pageSize: 1 });
    const second = await listCustomers({ q: SURNAME, channel: "ONLINE", page: 2, pageSize: 1 });
    const fifth = await listCustomers({ q: SURNAME, channel: "ONLINE", page: 5, pageSize: 1 });

    expect(first.customers).toHaveLength(1);
    expect(second.customers).toHaveLength(1);
    expect(first.customers[0].id).not.toBe(second.customers[0].id);
    expect(fifth.customers).toEqual([]);
    expect([first, second, fifth].every((r) => r.pagination.total === 4)).toBe(true);
    expect(first.pagination).toMatchObject({ page: 1, pageSize: 1 });
  });

  it("falls back to sane defaults for junk paging input and caps the page size", async () => {
    const junk = await listCustomers({ q: SURNAME, page: "banana", pageSize: -5 });
    expect(junk.pagination).toMatchObject({ page: 1, pageSize: 1 }); // -5 -> clamped to the minimum of 1

    const zero = await listCustomers({ q: SURNAME, page: 0, pageSize: "abc" });
    expect(zero.pagination).toMatchObject({ page: 1, pageSize: 25 });

    const huge = await listCustomers({ q: SURNAME, pageSize: 100000 });
    expect(huge.pagination.pageSize).toBe(100);
  });
});

describe("customers.service — deleteRegisteredCustomer", () => {
  const prefix = `customer-delete-test-${RUN}`;
  const orderPrefix = `CUSTOMER-DELETE-TEST-${RUN}`;
  let counter = 0;

  const makeCustomer = (overrides = {}) => {
    counter += 1;
    return prisma.customer.create({
      data: {
        email: `${prefix}-${counter}@example.com`,
        firstName: "Del",
        lastName: `Test${RUN}`,
        passwordHash: "x",
        emailVerifiedAt: new Date(),
        channel: "ONLINE",
        ...overrides,
      },
    });
  };

  afterAll(async () => {
    // Order numbers are count-based and the orders table is shared, so any
    // order a test created is removed here even if the test failed midway.
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: orderPrefix } } });
    await prisma.customerRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await prisma.customer.deleteMany({ where: { email: { startsWith: prefix } } });
  });

  it("permanently removes the customer row from the database", async () => {
    const customer = await makeCustomer();

    const result = await deleteRegisteredCustomer(customer.id);

    expect(result).toEqual({ id: customer.id, orderCount: 0 });
    expect(await prisma.customer.findUnique({ where: { id: customer.id } })).toBeNull();
    expect(await prisma.customer.count({ where: { email: customer.email } })).toBe(0);
  });

  it("keeps their orders but detaches them from the deleted customer", async () => {
    const customer = await makeCustomer();
    const order = await prisma.order.create({
      data: { orderNumber: `${orderPrefix}-A`, channel: "ONLINE", customerId: customer.id },
    });

    const result = await deleteRegisteredCustomer(customer.id);

    expect(result.orderCount).toBe(1);
    const kept = await prisma.order.findUnique({ where: { id: order.id } });
    expect(kept).not.toBeNull();
    expect(kept.customerId).toBeNull();
    await prisma.order.delete({ where: { id: order.id } });
  });

  it("also removes their saved addresses and any half-finished sign-up for the same email", async () => {
    const customer = await makeCustomer();
    await prisma.address.create({
      data: { customerId: customer.id, type: "SHIPPING", line1: "1 Test St", city: "Lake Wales", state: "FL", postalCode: "33853" },
    });
    const registrationData = { firstName: "P", lastName: "R", passwordHash: "x", codeHash: "x", expiresAt: new Date(Date.now() + 600000) };
    // Differently-cased address: registrations are matched case-insensitively.
    await prisma.customerRegistration.create({ data: { ...registrationData, email: customer.email.toUpperCase() } });
    const unrelated = await prisma.customerRegistration.create({ data: { ...registrationData, email: `${prefix}-unrelated@example.com` } });

    await deleteRegisteredCustomer(customer.id);

    expect(await prisma.address.count({ where: { customerId: customer.id } })).toBe(0);
    expect(await prisma.customerRegistration.count({ where: { email: { equals: customer.email, mode: "insensitive" } } })).toBe(0);
    expect(await prisma.customerRegistration.findUnique({ where: { id: unrelated.id } })).not.toBeNull();
  });

  it("does not touch other customers", async () => {
    const target = await makeCustomer();
    const bystander = await makeCustomer();

    await deleteRegisteredCustomer(target.id);

    expect(await prisma.customer.findUnique({ where: { id: bystander.id } })).not.toBeNull();
  });

  it("cannot delete guests, unverified rows or unknown ids, and leaves them in place", async () => {
    const guest = await makeCustomer({ passwordHash: null, emailVerifiedAt: null });
    const unverified = await makeCustomer({ emailVerifiedAt: null });

    for (const id of [guest.id, unverified.id, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      await expect(deleteRegisteredCustomer(id)).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(await prisma.customer.findUnique({ where: { id: guest.id } })).not.toBeNull();
    expect(await prisma.customer.findUnique({ where: { id: unverified.id } })).not.toBeNull();
  });

  it("a second delete of the same customer is a clean 404, not a crash", async () => {
    const customer = await makeCustomer();
    await deleteRegisteredCustomer(customer.id);

    await expect(deleteRegisteredCustomer(customer.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("drops them from the admin list immediately", async () => {
    const customer = await makeCustomer();
    expect((await listCustomers({ q: customer.email })).customers).toHaveLength(1);

    await deleteRegisteredCustomer(customer.id);

    expect((await listCustomers({ q: customer.email })).customers).toHaveLength(0);
  });
});
