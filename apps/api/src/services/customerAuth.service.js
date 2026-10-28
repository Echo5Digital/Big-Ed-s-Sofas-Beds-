const crypto = require("crypto");
const { Buffer } = require("buffer");
const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");
const { env } = require("../lib/env");
const { ApiError, ConflictError, UnauthorizedError } = require("../lib/errors");
const defaultMailer = require("../lib/mailer");

// Storefront customer sign-up (email + password, verified by a one-time code)
// and sign-in. A sign-up is held in CustomerRegistration until the emailed code
// is confirmed; only then does a Customer get its credentials. See the model's
// comment in schema.prisma for why nothing touches Customer before that.

const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_RESENDS = 5;
// Abandoned sign-ups are swept opportunistically on the next sign-up rather
// than by a scheduled job — there is no job runner in this API.
const STALE_REGISTRATION_MS = 24 * 60 * 60 * 1000;

const OTP_EXPIRES_IN_SECONDS = OTP_TTL_MS / 1000;
const OTP_RESEND_AVAILABLE_IN_SECONDS = OTP_RESEND_COOLDOWN_MS / 1000;

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// Keyed so a leaked CustomerRegistration table can't be brute-forced offline
// (a 6-digit code has only a million possibilities), and bound to the pending
// id so a code can't be replayed against a different sign-up.
function hashCode(pendingId, code) {
  return crypto.createHmac("sha256", env.jwtRefreshSecret).update(`customer-otp:${pendingId}:${code}`).digest("hex");
}

function codesMatch(expectedHex, actualHex) {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function toPublicCustomer(customer) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
  };
}

// Case-insensitive so an address a guest typed as "Jane@X.com" at checkout is
// still matched when she registers as "jane@x.com".
function findCustomerByEmail(client, email) {
  return client.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
}

// The sign-up exists but its code has timed out: the customer can ask for a
// fresh code (resend) without retyping anything.
function expiredError() {
  return new ApiError(410, "That code has expired. Request a new one to continue.", { reason: "expired" });
}

// The sign-up is gone (locked out, already completed, or never existed): there
// is nothing to resend to, so the customer has to start over.
function notFoundError() {
  return new ApiError(410, "This sign-up is no longer valid. Please start again.", { reason: "not_found" });
}

function cooldownError(retryAfterSeconds) {
  return new ApiError(429, `Please wait ${retryAfterSeconds}s before requesting another code.`, {
    reason: "cooldown",
    retryAfterSeconds,
  });
}

function emailFailedError() {
  return new ApiError(503, "We couldn't send your verification email. Please try again in a moment.", {
    reason: "email_failed",
  });
}

function secondsUntil(target, now) {
  return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));
}

async function deliverCode(mailer, { to, firstName, code }) {
  try {
    await mailer.sendVerificationCode({ to, firstName, code, expiresInMinutes: OTP_TTL_MS / 60000 });
  } catch (error) {
    console.error("[customerAuth] failed to send verification email", error);
    throw emailFailedError();
  }
}

async function startRegistration({ email, password, firstName, lastName }, { mailer = defaultMailer, now = new Date() } = {}) {
  await prisma.customerRegistration.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - STALE_REGISTRATION_MS) } },
  });

  const existing = await findCustomerByEmail(prisma, email);
  if (existing?.passwordHash && existing.emailVerifiedAt) {
    throw new ConflictError("An account with this email already exists. Please sign in.", { reason: "account_exists" });
  }

  // Cap how fast anyone can make us email a given address.
  const latest = await prisma.customerRegistration.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (latest) {
    const nextAllowedAt = new Date(latest.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS);
    if (nextAllowedAt > now) throw cooldownError(secondsUntil(nextAllowedAt, now));
  }

  const id = crypto.randomUUID();
  const code = generateCode();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Replacing (not adding to) any earlier pending sign-up for this email means
  // only the newest code and pending id can complete a registration.
  await prisma.$transaction([
    prisma.customerRegistration.deleteMany({ where: { email } }),
    prisma.customerRegistration.create({
      data: {
        id,
        email,
        firstName,
        lastName,
        passwordHash,
        codeHash: hashCode(id, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastSentAt: now,
      },
    }),
  ]);

  try {
    await deliverCode(mailer, { to: email, firstName, code });
  } catch (error) {
    await prisma.customerRegistration.deleteMany({ where: { id } });
    throw error;
  }

  return {
    pendingId: id,
    email,
    expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
    resendAvailableInSeconds: OTP_RESEND_AVAILABLE_IN_SECONDS,
  };
}

async function verifyRegistration({ pendingId, code }, { now = new Date() } = {}) {
  const registration = await prisma.customerRegistration.findUnique({ where: { id: pendingId } });
  if (!registration) throw notFoundError();

  if (registration.expiresAt <= now) {
    // Left in place (not deleted) so the customer can still request a fresh
    // code for this same sign-up via resend instead of retyping everything.
    throw expiredError();
  }

  // Count the attempt *before* comparing, atomically. Checking `attempts`
  // first and incrementing afterwards would let a burst of parallel guesses all
  // read attempts=0 and each get checked, defeating the limit. Incrementing
  // first guarantees at most OTP_MAX_ATTEMPTS comparisons ever happen.
  let updated;
  try {
    updated = await prisma.customerRegistration.update({
      where: { id: pendingId },
      data: { attempts: { increment: 1 } },
    });
  } catch (error) {
    if (error?.code === "P2025") throw notFoundError();
    throw error;
  }

  const lockedOut = () =>
    new ApiError(429, "Too many incorrect codes. Please start again.", { reason: "too_many_attempts" });

  if (updated.attempts > OTP_MAX_ATTEMPTS) {
    await prisma.customerRegistration.deleteMany({ where: { id: pendingId } });
    throw lockedOut();
  }

  if (!codesMatch(updated.codeHash, hashCode(pendingId, code))) {
    if (updated.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.customerRegistration.deleteMany({ where: { id: pendingId } });
      throw lockedOut();
    }
    throw new ApiError(400, "That code isn't right. Please check it and try again.", {
      reason: "invalid_code",
      attemptsRemaining: OTP_MAX_ATTEMPTS - updated.attempts,
    });
  }

  const customer = await prisma.$transaction(async (tx) => {
    // Deleting the row is the claim: if two verifications race with the same
    // correct code, only one sees count === 1 and the other fails.
    const claimed = await tx.customerRegistration.deleteMany({ where: { id: pendingId } });
    if (claimed.count === 0) throw notFoundError();

    const existing = await findCustomerByEmail(tx, registration.email);
    if (existing?.passwordHash) {
      throw new ConflictError("An account with this email already exists. Please sign in.", { reason: "account_exists" });
    }

    const verifiedAt = new Date();
    if (existing) {
      // A guest customer (from checkout/POS) now proves they own this email, so
      // the account attaches to their existing order history. Names the shop
      // already holds are kept; only blanks are filled in.
      return tx.customer.update({
        where: { id: existing.id },
        data: {
          passwordHash: registration.passwordHash,
          emailVerifiedAt: verifiedAt,
          firstName: existing.firstName ?? registration.firstName,
          lastName: existing.lastName ?? registration.lastName,
        },
      });
    }

    return tx.customer.create({
      data: {
        email: registration.email,
        firstName: registration.firstName,
        lastName: registration.lastName,
        passwordHash: registration.passwordHash,
        emailVerifiedAt: verifiedAt,
      },
    });
  });

  return toPublicCustomer(customer);
}

async function resendRegistrationCode({ pendingId }, { mailer = defaultMailer, now = new Date() } = {}) {
  const registration = await prisma.customerRegistration.findUnique({ where: { id: pendingId } });
  if (!registration) throw notFoundError();

  if (registration.resendCount >= OTP_MAX_RESENDS) {
    await prisma.customerRegistration.deleteMany({ where: { id: pendingId } });
    throw new ApiError(429, "Too many code requests. Please start again.", { reason: "too_many_resends" });
  }

  // The cooldown is enforced inside the UPDATE so two simultaneous resends
  // can't both pass a separate "is it cooled down?" check and send two emails.
  const code = generateCode();
  const cooledDownBefore = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
  const claimed = await prisma.customerRegistration.updateMany({
    where: { id: pendingId, lastSentAt: { lte: cooledDownBefore } },
    data: {
      codeHash: hashCode(pendingId, code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      attempts: 0,
      resendCount: { increment: 1 },
      lastSentAt: now,
    },
  });

  if (claimed.count === 0) {
    const nextAllowedAt = new Date(registration.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS);
    throw cooldownError(secondsUntil(nextAllowedAt, now));
  }

  await deliverCode(mailer, { to: registration.email, firstName: registration.firstName, code });

  return {
    pendingId,
    email: registration.email,
    expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
    resendAvailableInSeconds: OTP_RESEND_AVAILABLE_IN_SECONDS,
  };
}

// A real bcrypt hash to compare against when the email is unknown, so a
// non-existent account takes as long to reject as a wrong password does and
// response time can't be used to discover which emails have accounts.
let dummyHashPromise;
function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash(crypto.randomBytes(16).toString("hex"), BCRYPT_ROUNDS);
  return dummyHashPromise;
}

async function loginCustomer({ email, password }) {
  const customer = await findCustomerByEmail(prisma, email);
  const canSignIn = Boolean(customer?.passwordHash && customer.emailVerifiedAt);

  const passwordMatches = await bcrypt.compare(password, canSignIn ? customer.passwordHash : await getDummyHash());
  if (!canSignIn || !passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  return toPublicCustomer(customer);
}

// Used by the session middleware and /refresh. Re-reads from the database every
// time so an account that no longer qualifies can't ride out its token.
async function getSignedInCustomer(customerId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer?.passwordHash || !customer.emailVerifiedAt) return null;
  return toPublicCustomer(customer);
}

module.exports = {
  startRegistration,
  verifyRegistration,
  resendRegistrationCode,
  loginCustomer,
  getSignedInCustomer,
  // Exported for tests.
  hashCode,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_RESENDS,
};
