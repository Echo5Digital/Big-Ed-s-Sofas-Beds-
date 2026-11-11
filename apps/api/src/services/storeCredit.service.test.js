const { prisma } = require("@big-eds/database");
const storeCreditService = require("./storeCredit.service");

describe("storeCredit.service", () => {
  let customer;

  beforeAll(async () => {
    customer = await prisma.customer.create({
      data: { firstName: "Store", lastName: "Credit Test", phone: `555-${Date.now().toString().slice(-7)}` },
    });
  });

  afterAll(async () => {
    await prisma.storeCredit.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.$disconnect();
  });

  it("computes balance as the sum of issued and redeemed ledger rows", async () => {
    await prisma.$transaction((tx) =>
      storeCreditService.issueStoreCredit(tx, { customerId: customer.id, amountCents: 10000, performedById: null })
    );
    expect(await storeCreditService.getStoreCreditBalance(customer.id)).toBe(10000);

    await prisma.$transaction((tx) =>
      storeCreditService.redeemStoreCredit(tx, { customerId: customer.id, amountCents: 4000, performedById: null })
    );
    expect(await storeCreditService.getStoreCreditBalance(customer.id)).toBe(6000);
  });

  it("rejects a redemption that would exceed the current balance", async () => {
    const balance = await storeCreditService.getStoreCreditBalance(customer.id);
    await expect(
      prisma.$transaction((tx) =>
        storeCreditService.redeemStoreCredit(tx, {
          customerId: customer.id,
          amountCents: balance + 1,
          performedById: null,
        })
      )
    ).rejects.toThrow(/exceeds the customer's store credit balance/);
  });

  it("rejects issuing or redeeming without an identified customer", async () => {
    await expect(
      prisma.$transaction((tx) =>
        storeCreditService.issueStoreCredit(tx, { customerId: null, amountCents: 1000, performedById: null })
      )
    ).rejects.toThrow(/identified customer/);
    await expect(
      prisma.$transaction((tx) =>
        storeCreditService.redeemStoreCredit(tx, { customerId: null, amountCents: 1000, performedById: null })
      )
    ).rejects.toThrow(/identified customer/);
  });

  it("never lets two concurrent redemptions jointly exceed the balance", async () => {
    const freshCustomer = await prisma.customer.create({
      data: { firstName: "Concurrent", lastName: "Credit Test", phone: `555-${Date.now().toString().slice(-7)}` },
    });
    await prisma.$transaction((tx) =>
      storeCreditService.issueStoreCredit(tx, { customerId: freshCustomer.id, amountCents: 5000, performedById: null })
    );

    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        storeCreditService.redeemStoreCredit(tx, { customerId: freshCustomer.id, amountCents: 5000, performedById: null })
      ),
      prisma.$transaction((tx) =>
        storeCreditService.redeemStoreCredit(tx, { customerId: freshCustomer.id, amountCents: 5000, performedById: null })
      ),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    expect(succeeded.length).toBe(1);

    const finalBalance = await storeCreditService.getStoreCreditBalance(freshCustomer.id);
    expect(finalBalance).toBe(0);

    await prisma.storeCredit.deleteMany({ where: { customerId: freshCustomer.id } });
    await prisma.customer.delete({ where: { id: freshCustomer.id } });
  });
});
