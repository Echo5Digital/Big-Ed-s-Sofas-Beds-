const { prisma } = require("@big-eds/database");
const { NotFoundError } = require("../lib/errors");
const { escapeLikeWildcards } = require("../lib/searchText");

// A "registered" customer is one who created a storefront account and proved
// they own the email with the one-time code (see customerAuth.service.js).
// Used only by deleteRegisteredCustomer below — hard-deleting a customer stays
// limited to accounts with real login credentials; the list itself (below)
// now shows every customer, online and POS alike, distinguished by channel.
const REGISTERED = { passwordHash: { not: null }, emailVerifiedAt: { not: null } };

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_SEARCH_TERMS = 5;

function fieldsMatching(term) {
  const contains = { contains: escapeLikeWildcards(term), mode: "insensitive" };
  return { OR: [{ email: contains }, { firstName: contains }, { lastName: contains }] };
}

// Every whitespace-separated term must match somewhere, so "jane doe" finds
// Jane Doe even though her first and last name live in different columns.
// `channel` narrows to ONLINE or POS when given; omitted shows both.
function buildWhere(q, channel) {
  const terms = String(q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);

  const channelFilter = channel ? { channel } : {};
  return terms.length > 0 ? { ...channelFilter, AND: terms.map(fieldsMatching) } : channelFilter;
}

// Explicit `select`, never the whole row: passwordHash must not be able to
// reach a response through this path even by accident. `phone` IS shown (and
// can be real, current data — a signed-in customer can set it later from
// their storefront account page, see customerAccount.service.js updateProfile)
// but it is deliberately never made searchable below: a customer who later
// removes/changes their phone shouldn't still be findable by an old one.
//
// Address shows the customer's default address (falls back to their most
// recent, so someone with one saved address but no explicit default still
// shows it). Total spend / AOV mirror the rest of the admin's reporting
// convention (reports.routes.js): Order.totalCents on non-canceled orders,
// not a strict sum of Payment rows — this is "what they were charged for",
// consistent with every other sales figure staff see elsewhere in the app.
function serialize(customer) {
  const address = customer.addresses[0] ?? null;
  const orders = customer.orders;
  const orderCount = orders.length;
  const totalSpendCents = orders.reduce((sum, o) => sum + o.totalCents, 0);

  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    channel: customer.channel,
    registeredAt: customer.emailVerifiedAt,
    address: address
      ? {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        }
      : null,
    orderCount,
    totalSpendCents,
    averageOrderValueCents: orderCount > 0 ? Math.round(totalSpendCents / orderCount) : 0,
  };
}

// Lists every Customer row — both ONLINE (storefront accounts and guest
// checkouts) and POS (cashier-created walk-in customers) — optionally
// narrowed to one channel. `channel` in each returned row is what the admin
// UI uses to label/filter by how the customer was created.
async function listCustomers({ q, page, pageSize, channel } = {}) {
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(pageSize)) || DEFAULT_PAGE_SIZE));
  const currentPage = Math.max(1, Math.floor(Number(page)) || 1);
  const where = buildWhere(q, channel);

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      // Newest first; id breaks ties so paging is stable.
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (currentPage - 1) * take,
      take,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        channel: true,
        emailVerifiedAt: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true },
        },
        orders: {
          where: { status: { not: "CANCELED" } },
          select: { totalCents: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers: rows.map(serialize),
    pagination: { page: currentPage, pageSize: take, total },
  };
}

// Permanently removes a registered customer's account from the database (a hard
// delete, by design — the row is gone, not flagged).
//
// What happens to what's linked to them, per the schema's onDelete rules:
//   - Address rows are deleted with the customer (cascade).
//   - Orders are kept — they're sales records — but detach from the customer
//     (customerId becomes null), so an order no longer shows who it was for.
//   - Any half-finished sign-up for the same email is deleted here explicitly:
//     CustomerRegistration is keyed by email, not by a foreign key, so nothing
//     would remove it otherwise.
// Their signed-in sessions stop working on the next request, since the session
// middleware re-reads the customer from the database every time.
//
// Only registered accounts (real login credentials) can be deleted through
// this path — guest/POS-created rows, now also shown in listCustomers above,
// are not reachable by it.
async function deleteRegisteredCustomer(customerId) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: String(customerId), ...REGISTERED },
      select: { id: true, email: true, _count: { select: { orders: true } } },
    });
    if (!customer) throw new NotFoundError("Customer not found");

    await tx.customerRegistration.deleteMany({ where: { email: { equals: customer.email, mode: "insensitive" } } });
    await tx.customer.delete({ where: { id: customer.id } });

    return { id: customer.id, orderCount: customer._count.orders };
  });
}

module.exports = { listCustomers, deleteRegisteredCustomer };
