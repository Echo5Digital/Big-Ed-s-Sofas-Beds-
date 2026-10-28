const { prisma } = require("@big-eds/database");
const service = require("./customerAuth.service");

// Runs against the real dev database (same convention as pos.service.test.js —
// no Prisma mock layer). The mailer is faked so no email is sent, and the
// service's injectable clock (`now`) stands in for waiting out the 10-minute
// code lifetime and 60-second resend cooldown.
const RUN = Date.now();
const emailPrefix = `customer-auth-test-${RUN}`;
let emailCounter = 0;
const newEmail = () => `${emailPrefix}-${(emailCounter += 1)}@example.com`;

const PASSWORD = "CorrectHorse1!";
const minutesFromNow = (m) => new Date(Date.now() + m * 60 * 1000);
const secondsFromNow = (s) => new Date(Date.now() + s * 1000);

function fakeMailer() {
  const sent = [];
  return {
    sent,
    sendVerificationCode: async (message) => {
      sent.push(message);
    },
    lastCodeFor: (email) => [...sent].reverse().find((m) => m.to === email)?.code,
  };
}

function register(email, mailer, overrides = {}, options = {}) {
  return service.startRegistration(
    { email, password: PASSWORD, firstName: "Test", lastName: "Customer", ...overrides },
    { mailer, ...options }
  );
}

function wrongCodeFor(code) {
  return code === "000000" ? "000001" : "000000";
}

describe("customerAuth.service — sign-up with emailed one-time code", () => {
  afterAll(async () => {
    await prisma.customerRegistration.deleteMany({ where: { email: { startsWith: emailPrefix } } });
    await prisma.customer.deleteMany({ where: { email: { startsWith: emailPrefix, mode: "insensitive" } } });
  });

  it("registering emails a code and creates NO customer until it is confirmed", async () => {
    const mailer = fakeMailer();
    const email = newEmail();

    const result = await register(email, mailer);

    expect(result.pendingId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].code).toMatch(/^\d{6}$/);
    expect(await prisma.customer.findFirst({ where: { email } })).toBeNull();

    const row = await prisma.customerRegistration.findUnique({ where: { id: result.pendingId } });
    expect(row.codeHash).not.toContain(mailer.sent[0].code); // only a hash is stored
    expect(row.passwordHash).not.toBe(PASSWORD);
  });

  it("a correct code creates a verified customer that can then sign in", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);

    const customer = await service.verifyRegistration({ pendingId, code: mailer.lastCodeFor(email) });

    expect(customer.email).toBe(email);
    const stored = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(stored.emailVerifiedAt).toBeInstanceOf(Date);
    expect(stored.passwordHash).toBeTruthy();
    expect(await prisma.customerRegistration.findUnique({ where: { id: pendingId } })).toBeNull();

    const signedIn = await service.loginCustomer({ email, password: PASSWORD });
    expect(signedIn.id).toBe(customer.id);
  });

  it("a wrong code is rejected and reports remaining attempts", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);

    await expect(
      service.verifyRegistration({ pendingId, code: wrongCodeFor(mailer.lastCodeFor(email)) })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: { reason: "invalid_code", attemptsRemaining: service.OTP_MAX_ATTEMPTS - 1 },
    });
    expect(await prisma.customer.findFirst({ where: { email } })).toBeNull();
  });

  it("locks the sign-up out after too many wrong codes, even if the right code follows", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);
    const code = mailer.lastCodeFor(email);

    for (let i = 1; i < service.OTP_MAX_ATTEMPTS; i += 1) {
      await expect(service.verifyRegistration({ pendingId, code: wrongCodeFor(code) })).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    await expect(service.verifyRegistration({ pendingId, code: wrongCodeFor(code) })).rejects.toMatchObject({
      statusCode: 429,
      details: { reason: "too_many_attempts" },
    });

    await expect(service.verifyRegistration({ pendingId, code })).rejects.toMatchObject({
      details: { reason: "not_found" },
    });
    expect(await prisma.customer.findFirst({ where: { email } })).toBeNull();
  });

  it("parallel guesses cannot exceed the attempt limit (no check-then-increment race)", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);
    const code = mailer.lastCodeFor(email);

    const burst = await Promise.allSettled(
      Array.from({ length: 25 }, () => service.verifyRegistration({ pendingId, code: wrongCodeFor(code) }))
    );
    expect(burst.every((r) => r.status === "rejected")).toBe(true);

    // Whatever order the burst landed in, the sign-up must now be dead: the
    // genuine code no longer works.
    await expect(service.verifyRegistration({ pendingId, code })).rejects.toBeDefined();
    expect(await prisma.customer.findFirst({ where: { email } })).toBeNull();
  });

  it("two simultaneous verifications with the correct code create exactly one customer", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);
    const code = mailer.lastCodeFor(email);

    const results = await Promise.allSettled([
      service.verifyRegistration({ pendingId, code }),
      service.verifyRegistration({ pendingId, code }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.customer.count({ where: { email } })).toBe(1);
  });

  it("an expired code is refused, and a resent code then completes the same sign-up", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);
    const firstCode = mailer.lastCodeFor(email);

    const afterExpiry = minutesFromNow(service.OTP_TTL_MS / 60000 + 1);
    await expect(service.verifyRegistration({ pendingId, code: firstCode }, { now: afterExpiry })).rejects.toMatchObject({
      statusCode: 410,
      details: { reason: "expired" },
    });

    await service.resendRegistrationCode({ pendingId }, { mailer, now: afterExpiry });
    expect(mailer.sent).toHaveLength(2);

    const customer = await service.verifyRegistration(
      { pendingId, code: mailer.lastCodeFor(email) },
      { now: afterExpiry }
    );
    expect(customer.email).toBe(email);
  });

  it("resend is blocked during the cooldown and after the resend cap", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);

    await expect(service.resendRegistrationCode({ pendingId }, { mailer })).rejects.toMatchObject({
      statusCode: 429,
      details: { reason: "cooldown" },
    });
    expect(mailer.sent).toHaveLength(1); // the blocked resend sent nothing

    // Each resend resets the attempt counter, so previously failed guesses
    // can't be banked toward the lockout across resends.
    let clock = Date.now();
    for (let i = 0; i < service.OTP_MAX_RESENDS; i += 1) {
      clock += service.OTP_RESEND_COOLDOWN_MS + 1000;
      await service.resendRegistrationCode({ pendingId }, { mailer, now: new Date(clock) });
    }
    clock += service.OTP_RESEND_COOLDOWN_MS + 1000;
    await expect(
      service.resendRegistrationCode({ pendingId }, { mailer, now: new Date(clock) })
    ).rejects.toMatchObject({ statusCode: 429, details: { reason: "too_many_resends" } });
  });

  it("an old code is useless once the same email starts a fresh sign-up", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const first = await register(email, mailer);
    const firstCode = mailer.lastCodeFor(email);

    const later = secondsFromNow(service.OTP_RESEND_COOLDOWN_MS / 1000 + 1);
    const second = await register(email, mailer, {}, { now: later });
    expect(second.pendingId).not.toBe(first.pendingId);

    await expect(service.verifyRegistration({ pendingId: first.pendingId, code: firstCode })).rejects.toMatchObject({
      details: { reason: "not_found" },
    });
    expect(await prisma.customerRegistration.count({ where: { email } })).toBe(1);
  });

  it("registering again straight away is throttled, so an address can't be spammed", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    await register(email, mailer);

    await expect(register(email, mailer)).rejects.toMatchObject({ statusCode: 429, details: { reason: "cooldown" } });
    expect(mailer.sent).toHaveLength(1);
  });

  it("refuses to register an email that already has a verified account", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const { pendingId } = await register(email, mailer);
    await service.verifyRegistration({ pendingId, code: mailer.lastCodeFor(email) });

    await expect(register(email, mailer, {}, { now: minutesFromNow(5) })).rejects.toMatchObject({
      statusCode: 409,
      details: { reason: "account_exists" },
    });
  });

  it("a failed email send leaves no pending sign-up behind and reports it", async () => {
    const email = newEmail();
    const brokenMailer = {
      sendVerificationCode: async () => {
        throw new Error("smtp down");
      },
    };
    const consoleError = console.error;
    console.error = () => {};
    try {
      await expect(register(email, brokenMailer)).rejects.toMatchObject({
        statusCode: 503,
        details: { reason: "email_failed" },
      });
    } finally {
      console.error = consoleError;
    }
    expect(await prisma.customerRegistration.count({ where: { email } })).toBe(0);
  });

  it("a guest customer from checkout adopts the account after proving the email, keeping their record", async () => {
    const mailer = fakeMailer();
    const email = newEmail();
    const guest = await prisma.customer.create({
      data: { email: email.toUpperCase().replace("@EXAMPLE.COM", "@example.com"), firstName: "Guest", lastName: "Shopper", phone: "555-0100" },
    });
    expect(guest.passwordHash).toBeNull();

    // Guests can't sign in before registering.
    await expect(service.loginCustomer({ email: guest.email.toLowerCase(), password: PASSWORD })).rejects.toMatchObject({
      statusCode: 401,
    });

    const { pendingId } = await register(email, mailer, { firstName: "Different", lastName: "Name" });
    const customer = await service.verifyRegistration({ pendingId, code: mailer.lastCodeFor(email) });

    expect(customer.id).toBe(guest.id); // same row: order history stays attached
    const stored = await prisma.customer.findUnique({ where: { id: guest.id } });
    expect(stored.firstName).toBe("Guest"); // shop's existing data wins
    expect(stored.phone).toBe("555-0100");
    expect(stored.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await prisma.customer.count({ where: { email: { equals: email, mode: "insensitive" } } })).toBe(1);
  });
});

describe("customerAuth.service — sign-in", () => {
  const email = `${emailPrefix}-login@example.com`;

  beforeAll(async () => {
    const mailer = fakeMailer();
    const { pendingId } = await register(email, mailer);
    await service.verifyRegistration({ pendingId, code: mailer.lastCodeFor(email) });
  });

  // Sweeps the whole run prefix, not just `email`: the tests below also create
  // a pending sign-up and a guest customer under newEmail(), and the first
  // describe's cleanup has already run by the time they exist.
  afterAll(async () => {
    await prisma.customerRegistration.deleteMany({ where: { email: { startsWith: emailPrefix } } });
    await prisma.customer.deleteMany({ where: { email: { startsWith: emailPrefix, mode: "insensitive" } } });
  });

  it("accepts the right password, case-insensitively on the email", async () => {
    const customer = await service.loginCustomer({ email: email.toUpperCase(), password: PASSWORD });
    expect(customer.email).toBe(email);
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const wrongPassword = await service.loginCustomer({ email, password: "nope-nope-nope" }).catch((e) => e);
    const unknownEmail = await service
      .loginCustomer({ email: `${emailPrefix}-nobody@example.com`, password: PASSWORD })
      .catch((e) => e);

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.message).toBe(unknownEmail.message);
  });

  it("does not let an unverified, still-pending sign-up log in", async () => {
    const pendingEmail = newEmail();
    await register(pendingEmail, fakeMailer());

    await expect(service.loginCustomer({ email: pendingEmail, password: PASSWORD })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("getSignedInCustomer returns null for a guest with no password", async () => {
    const guest = await prisma.customer.create({ data: { email: newEmail(), firstName: "No", lastName: "Password" } });
    expect(await service.getSignedInCustomer(guest.id)).toBeNull();
  });
});
