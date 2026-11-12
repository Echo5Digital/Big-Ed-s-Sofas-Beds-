// Role-prefixed, human-readable badge number — MGR001, SLS001, CSH001 — used
// to attribute activities (receipts, audit trails) to a person at a glance,
// distinct from their internal uuid `id`. Admin has no prefix: a user who is
// Admin-only (no Manager/Salesman/Cashier role) gets no employeeId.
//
// A user can hold multiple roles at once (see UserRole), so the prefix picks
// the single highest-priority role below, in that fixed order — there is no
// "primary role" concept in the data model otherwise. The id is regenerated
// whenever a user's role set changes (apps/api/src/routes/users.routes.js),
// so it always reflects whichever of these roles currently applies, rather
// than freezing at creation time the way orderNumber/poNumber do.
const PREFIX_BY_ROLE_PRIORITY = [
  ["MANAGER", "MGR"],
  ["SALESMAN", "SLS"],
  ["CASHIER", "CSH"],
];

function prefixForRoles(roleNames) {
  for (const [role, prefix] of PREFIX_BY_ROLE_PRIORITY) {
    if (roleNames.includes(role)) return prefix;
  }
  return null;
}

// Counts existing ids by prefix (string match) rather than by current role
// assignment, so the sequence never collides or skips regardless of how many
// users have since changed roles away from this prefix.
async function nextEmployeeId(roleNames, tx) {
  const prefix = prefixForRoles(roleNames);
  if (!prefix) return null;

  const count = await tx.user.count({ where: { employeeId: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

module.exports = { nextEmployeeId, prefixForRoles };
