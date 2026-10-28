const { prisma } = require("@big-eds/database");

// A "registered" customer is one who created a storefront account and proved
// they own the email with the one-time code (see customerAuth.service.js).
// Guests created implicitly by checkout/POS have neither field set, so they are
// not listed here — they're still visible through their orders.
const REGISTERED = { passwordHash: { not: null }, emailVerifiedAt: { not: null } };

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_SEARCH_TERMS = 5;

function fieldsMatching(term) {
  const contains = { contains: term, mode: "insensitive" };
  return { OR: [{ email: contains }, { firstName: contains }, { lastName: contains }] };
}

// Every whitespace-separated term must match somewhere, so "jane doe" finds
// Jane Doe even though her first and last name live in different columns.
function buildWhere(q) {
  const terms = String(q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);

  return terms.length > 0 ? { ...REGISTERED, AND: terms.map(fieldsMatching) } : REGISTERED;
}

// Explicit `select`, never the whole row: passwordHash must not be able to
// reach a response through this path even by accident. `phone` is left out on
// purpose too — sign-up doesn't collect one, so any value on the row came from
// an earlier guest checkout and would misrepresent what the account provided.
function serialize(customer) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    registeredAt: customer.emailVerifiedAt,
    orderCount: customer._count.orders,
  };
}

async function listRegisteredCustomers({ q, page, pageSize } = {}) {
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(pageSize)) || DEFAULT_PAGE_SIZE));
  const currentPage = Math.max(1, Math.floor(Number(page)) || 1);
  const where = buildWhere(q);

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      // Newest registrations first; id breaks ties so paging is stable.
      orderBy: [{ emailVerifiedAt: "desc" }, { id: "asc" }],
      skip: (currentPage - 1) * take,
      take,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers: rows.map(serialize),
    pagination: { page: currentPage, pageSize: take, total },
  };
}

module.exports = { listRegisteredCustomers };
