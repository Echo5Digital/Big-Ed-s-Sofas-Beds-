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

const { nextSequenceValue } = require("./sequentialNumber");

// Each role prefix has its own counter (key "employeeId:<prefix>") rather
// than counting existing rows by prefix — a role prefix's highest-issued
// number can't regress even if a user with that prefix is later deleted or
// changes roles, the same guarantee count()-by-prefix was going for, but
// without its read-then-write race.
async function nextEmployeeId(roleNames, tx) {
  const prefix = prefixForRoles(roleNames);
  if (!prefix) return null;

  const count = await nextSequenceValue(`employeeId:${prefix}`, tx);
  return `${prefix}${String(count).padStart(3, "0")}`;
}

module.exports = { nextEmployeeId, prefixForRoles };
