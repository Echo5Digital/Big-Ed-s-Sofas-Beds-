const bcrypt = require("bcryptjs");
const { prisma } = require("@big-eds/database");
const { ApiError, NotFoundError, ConflictError } = require("../lib/errors");

// What a signed-in storefront customer can see and change about their own
// account: profile, password, saved addresses, order history. Every function
// takes the customerId taken from the verified session (never from the request
// body or URL), and every query is scoped by it, so one customer can never read
// or touch another's rows.

const BCRYPT_ROUNDS = 12;
const MAX_ADDRESSES = 10;
const ORDERS_PAGE_SIZE = 10;
const MAX_ORDERS_PAGE_SIZE = 50;

function serializeProfile(customer) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    memberSince: customer.emailVerifiedAt ?? customer.createdAt,
  };
}

async function getProfile(customerId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new NotFoundError("Account not found");
  return serializeProfile(customer);
}

async function updateProfile(customerId, { firstName, lastName, phone }) {
  try {
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName,
        lastName,
        // Left alone when the field wasn't sent; cleared when sent blank (null).
        ...(phone !== undefined ? { phone } : {}),
      },
    });
    return serializeProfile(customer);
  } catch (error) {
    // The account was deleted by staff after this session's last check.
    if (error?.code === "P2025") throw new NotFoundError("Account not found");
    throw error;
  }
}

// A wrong current password answers 400, never 401: the storefront treats 401
// as "your session expired" and signs the customer out, which would be the
// wrong reaction to a typo.
async function changePassword(customerId, { currentPassword, newPassword }) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer?.passwordHash) throw new NotFoundError("Account not found");

  const matches = await bcrypt.compare(currentPassword, customer.passwordHash);
  if (!matches) {
    throw new ApiError(400, "Your current password isn't right.", { reason: "incorrect_password" });
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  // Guarded on the hash we just verified against: if the password was changed
  // from another tab/device in the meantime, this update does nothing instead
  // of silently overwriting that change.
  const updated = await prisma.customer.updateMany({
    where: { id: customerId, passwordHash: customer.passwordHash },
    data: { passwordHash },
  });
  if (updated.count === 0) {
    throw new ConflictError("Your password was just changed elsewhere. Please try again.", { reason: "stale_password" });
  }
}

// --- Addresses ---------------------------------------------------------------

function serializeAddress(address) {
  return {
    id: address.id,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
  };
}

// Default first, then oldest first so the list doesn't reshuffle on edits.
const ADDRESS_ORDER = [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }];

async function listAddresses(customerId) {
  const addresses = await prisma.address.findMany({ where: { customerId }, orderBy: ADDRESS_ORDER });
  return addresses.map(serializeAddress);
}

async function findOwnedAddress(client, customerId, addressId) {
  const address = await client.address.findFirst({ where: { id: String(addressId), customerId } });
  if (!address) throw new NotFoundError("Address not found");
  return address;
}

async function createAddress(customerId, input) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.count({ where: { customerId } });
    if (existing >= MAX_ADDRESSES) {
      throw new ConflictError(`You can save up to ${MAX_ADDRESSES} addresses. Remove one to add another.`, {
        reason: "address_limit",
      });
    }

    // The first address is always the default; later ones only when asked.
    const makeDefault = existing === 0 || input.isDefault === true;
    if (makeDefault) {
      await tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
    }

    const address = await tx.address.create({
      data: {
        customerId,
        // Customers manage delivery addresses here; BILLING is for staff-side use.
        type: "SHIPPING",
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        ...(input.country ? { country: input.country } : {}),
        isDefault: makeDefault,
      },
    });
    return serializeAddress(address);
  });
}

async function updateAddress(customerId, addressId, input) {
  return prisma.$transaction(async (tx) => {
    const current = await findOwnedAddress(tx, customerId, addressId);

    // Unticking "default" on the only/current default would leave no default,
    // so that request is ignored — a different address has to be made default.
    const makeDefault = input.isDefault === true && !current.isDefault;
    if (makeDefault) {
      await tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
    }

    const address = await tx.address.update({
      where: { id: current.id },
      data: {
        ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
        ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(makeDefault ? { isDefault: true } : {}),
      },
    });
    return serializeAddress(address);
  });
}

async function setDefaultAddress(customerId, addressId) {
  return prisma.$transaction(async (tx) => {
    const current = await findOwnedAddress(tx, customerId, addressId);
    if (!current.isDefault) {
      await tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
      await tx.address.update({ where: { id: current.id }, data: { isDefault: true } });
    }
    const addresses = await tx.address.findMany({ where: { customerId }, orderBy: ADDRESS_ORDER });
    return addresses.map(serializeAddress);
  });
}

async function deleteAddress(customerId, addressId) {
  return prisma.$transaction(async (tx) => {
    const current = await findOwnedAddress(tx, customerId, addressId);
    await tx.address.delete({ where: { id: current.id } });

    // Removing the default hands the role to the oldest remaining address.
    if (current.isDefault) {
      const next = await tx.address.findFirst({ where: { customerId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    const addresses = await tx.address.findMany({ where: { customerId }, orderBy: ADDRESS_ORDER });
    return addresses.map(serializeAddress);
  });
}

// --- Orders ------------------------------------------------------------------

// DRAFT orders are checkouts still being assembled and haven't been confirmed
// yet, so they aren't shown. Orders that were confirmed but not paid (an
// abandoned payment step) are shown, labelled by their payment status.
const VISIBLE_ORDERS = { status: { not: "DRAFT" } };

function serializeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    placedAt: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillmentMethod: order.fulfillmentMethod,
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    deliveryFeeCents: order.deliveryFeeCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    lines: order.lines.map((line) => ({
      id: line.id,
      name: line.nameSnapshot,
      sku: line.skuSnapshot,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
    })),
  };
}

async function listOrders(customerId, { page, pageSize } = {}) {
  const take = Math.min(MAX_ORDERS_PAGE_SIZE, Math.max(1, Math.floor(Number(pageSize)) || ORDERS_PAGE_SIZE));
  const currentPage = Math.max(1, Math.floor(Number(page)) || 1);
  const where = { customerId, ...VISIBLE_ORDERS };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { lines: { orderBy: { createdAt: "asc" } } },
      // id breaks ties so paging stays stable when orders share a timestamp.
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(serializeOrder),
    pagination: { page: currentPage, pageSize: take, total },
  };
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  listOrders,
  MAX_ADDRESSES,
};
