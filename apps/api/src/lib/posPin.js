const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");

const BCRYPT_ROUNDS = 12;

function hashPin(rawPin) {
  return bcrypt.hash(rawPin, BCRYPT_ROUNDS);
}

// A PIN cannot be looked up by a unique index — there is no uniqueness
// constraint on posPinHash (salted bcrypt output never collides meaningfully,
// and nothing stops two managers from picking the same 4-digit PIN). So
// verification fetches every active user holding the required permission
// with a PIN set (a small, bounded set — managers/admins only) and compares
// against each hash until one matches. This is also what makes "the PIN
// owner's permission is checked, not the cashier's" hold: a cashier's own
// PIN (if one were ever set) is never in this candidate set, so it can never
// authorize an override even if its digits happen to match.
async function verifyManagerPin(rawPin, { requiredPermission = "pos:register:approve-reopen" } = {}) {
  const candidates = await prisma.user.findMany({
    where: {
      isActive: true,
      posPinHash: { not: null },
      roles: { some: { role: { permissions: { some: { permission: { key: requiredPermission } } } } } },
    },
    select: { id: true, posPinHash: true },
  });

  for (const candidate of candidates) {
    if (await bcrypt.compare(rawPin, candidate.posPinHash)) {
      return candidate.id;
    }
  }
  return null;
}

module.exports = { hashPin, verifyManagerPin };
