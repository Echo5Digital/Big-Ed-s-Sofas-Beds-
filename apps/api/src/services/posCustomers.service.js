const { prisma } = require("@big-eds/database");
const { escapeLikeWildcards } = require("../lib/searchText");
const { findDuplicateAddress } = require("./customerAccount.service");

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

// Address is the customer's default saved address (if any) — same shape
// AddressFields/EMPTY_ADDRESS in the POS checkout expect, so the cashier
// screen can drop this straight into state without reshaping it. Only ever
// the default: a POS customer can in principle have more than one saved
// address (created via the admin/account APIs), but the checkout screen has
// one billing/shipping slot each, not a picker, so the single most-likely
// one wins — same "first/default address wins" convention as checkout's own
// saveCheckoutDeliveryAddress.
function serializeAddress(address) {
  if (!address) return null;
  return {
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  };
}

function serialize(customer) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    address: serializeAddress(customer.addresses?.[0]),
  };
}

const DEFAULT_ADDRESS_INCLUDE = {
  addresses: { where: { isDefault: true }, take: 1 },
};

async function searchCustomersForPos({ q }) {
  const where = buildWhere(q);
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: DEFAULT_ADDRESS_INCLUDE,
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

  let savedAddress = null;
  if (address) {
    // BILLING, not SHIPPING: this is the address a walk-in customer gives
    // the cashier for their own record/billing purposes, not a delivery
    // destination — a POS sale's own delivery address (if any) is captured
    // per-order on the Order itself (see ringSale's shippingAddress), not on
    // the Customer's saved address book. The upsert above can land on a
    // customer who already has a default address (repeat walk-in, typed a
    // new one this visit) — clear the old default first so there's never
    // more than one, same rule customerAccount.service.js's createAddress
    // follows for storefront-managed addresses.
    //
    // A repeat walk-in matched by email (the upsert above) re-giving the
    // cashier the same address every visit used to create a fresh row each
    // time — findDuplicateAddress (same case/whitespace-insensitive match
    // customerAccount.service.js's own createAddress uses) reuses that row
    // instead, just promoting it back to default.
    savedAddress = await prisma.$transaction(async (tx) => {
      const duplicate = await findDuplicateAddress(tx, customer.id, address);
      if (duplicate) {
        if (duplicate.isDefault) return duplicate;
        await tx.address.updateMany({ where: { customerId: customer.id, isDefault: true }, data: { isDefault: false } });
        return tx.address.update({ where: { id: duplicate.id }, data: { isDefault: true } });
      }

      await tx.address.updateMany({ where: { customerId: customer.id, isDefault: true }, data: { isDefault: false } });
      return tx.address.create({
        data: {
          customerId: customer.id,
          type: "BILLING",
          line1: address.line1,
          line2: address.line2 || null,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          isDefault: true,
        },
      });
    });
  } else if (email) {
    // No address typed this visit — a repeat walk-in matched by email may
    // still have one on file from a previous visit; surface it rather than
    // reporting "no address" just because this particular call didn't send one.
    savedAddress = await prisma.address.findFirst({ where: { customerId: customer.id, isDefault: true } });
  }

  return serialize({ ...customer, addresses: savedAddress ? [savedAddress] : [] });
}

module.exports = {
  searchCustomersForPos,
  createPosCustomer,
  serialize,
};
