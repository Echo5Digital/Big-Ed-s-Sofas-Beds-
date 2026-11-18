const { prisma } = require("@big-eds/database");
const { escapeLikeWildcards } = require("../lib/searchText");

const MAX_SEARCH_TERMS = 5;
const MAX_RESULTS = 25;

// Unlike customers.service.js's listRegisteredCustomers (scoped to verified
// storefront accounts only, and deliberately excludes phone from search — see
// that file's own test), POS checkout needs to find any PREVIOUSLY
// POS-CREATED customer — by name, phone, or email. Every whitespace-separated
// term must match somewhere (same multi-term AND-of-OR pattern as
// customers.service.js:buildWhere) so "jane 555" finds Jane even though her
// name and phone live in different columns.
//
// Scoped to channel: "POS" — a cashier searching for a repeat walk-in
// customer must never surface (or be able to attach a sale to) someone's
// separate ONLINE-channel account, even if the name/email/phone matches. See
// Customer.channel in schema.prisma for why the two never merge.
function fieldsMatching(term) {
  const contains = { contains: escapeLikeWildcards(term), mode: "insensitive" };
  return { OR: [{ email: contains }, { firstName: contains }, { lastName: contains }, { phone: contains }] };
}

function buildWhere(q) {
  const terms = String(q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);
  return { AND: [{ channel: "POS" }, ...terms.map(fieldsMatching)] };
}

function serialize(customer) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
  };
}

async function searchCustomersForPos({ q }) {
  const where = buildWhere(q);
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: MAX_RESULTS,
    }),
    prisma.customer.count({ where }),
  ]);
  return { customers: customers.map(serialize), total };
}

// Shared by the explicit "create customer" endpoint and ringSale()'s inline
// customer attachment, so both code paths upsert-by-email identically
// instead of diverging. Falls back to a plain create when no email is given
// (optional per the checkout spec) — there's no unique key to upsert against
// in that case. Always channel: "POS" — this never touches, and can never
// collide with, a same-email ONLINE-channel row (see Customer.channel).
async function createPosCustomer({ firstName, lastName, phone, email, address }) {
  const customerData = { firstName, lastName, phone, email: email || null, channel: "POS" };

  const customer = email
    ? await prisma.customer.upsert({
        where: { email_channel: { email, channel: "POS" } },
        update: { firstName, lastName, phone },
        create: customerData,
      })
    : await prisma.customer.create({ data: customerData });

  if (address) {
    await prisma.address.create({
      data: {
        customerId: customer.id,
        type: "SHIPPING",
        line1: address.line1,
        line2: address.line2 || null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        isDefault: true,
      },
    });
  }

  return serialize(customer);
}

module.exports = {
  searchCustomersForPos,
  createPosCustomer,
  serialize,
};
