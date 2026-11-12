// One-time backfill: assigns a role-prefixed employee id (MGR###, SLS###,
// CSH###) to any existing user who has a qualifying role (Manager, Salesman,
// or Cashier, in that priority order — see apps/api/src/lib/employeeId.js for
// the same precedence used going forward on create/role-change) but no
// employeeId yet, because they were created before this field existed.
//
// Scope-limited, not re-run-guarded by a flag: only touches employeeId IS
// NULL rows, so running this again after everyone has a real id is a no-op.
// Processes users oldest-first (createdAt) so the assigned sequence is
// deterministic and reproducible.
//
// Usage: node packages/database/prisma/backfill-employee-ids.js

const { PrismaClient } = require("../generated/client");

const prisma = new PrismaClient();

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

async function main() {
  const users = await prisma.user.findMany({
    where: { employeeId: null },
    include: { roles: { include: { role: true } } },
    orderBy: { createdAt: "asc" },
  });

  const counters = {};
  for (const [, prefix] of PREFIX_BY_ROLE_PRIORITY) {
    counters[prefix] = await prisma.user.count({ where: { employeeId: { startsWith: prefix } } });
  }

  let assigned = 0;
  for (const user of users) {
    const roleNames = user.roles.map((ur) => ur.role.name);
    const prefix = prefixForRoles(roleNames);
    if (!prefix) continue; // Admin-only users get no employeeId.

    counters[prefix] += 1;
    const employeeId = `${prefix}${String(counters[prefix]).padStart(3, "0")}`;
    await prisma.user.update({ where: { id: user.id }, data: { employeeId } });
    console.log(`  ${user.email}: (none) -> ${employeeId}`);
    assigned += 1;
  }

  console.log(assigned === 0 ? "No users needed a backfilled employee id." : `Backfilled ${assigned} employee id(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
