const { prisma } = require("@big-eds/database");
const { findDuplicateAddress } = require("./customerAccount.service");

// Saves the delivery address a storefront customer typed at checkout as a
// real Address row linked to their Customer, the same way the storefront's
// own "my addresses" account page does it (see customerAccount.service.js
// createAddress) — so it shows up there too, not just on this one order.
// Deliberately its own standalone transaction, run before orders.routes.js
// opens the order-creation transaction — the address isn't part of what
// that transaction needs to roll back together (an out-of-stock failure
// cancels the order, not the customer's saved address).
//
// Reuses findDuplicateAddress (same case/whitespace-insensitive match
// customerAccount.service.js's own createAddress uses) so picking an
// already-saved address at checkout — the common case, since the picker is
// pre-filled from the account's address book — reuses that row instead of
// creating a second, identical one on every single order.
async function saveCheckoutDeliveryAddress(customerId, deliveryAddress) {
  if (!deliveryAddress) return null;

  return prisma.$transaction(async (tx) => {
    const duplicate = await findDuplicateAddress(tx, customerId, deliveryAddress);
    if (duplicate) return duplicate;

    const hasDefault = await tx.address.findFirst({ where: { customerId, isDefault: true } });
    return tx.address.create({
      data: {
        customerId,
        type: "SHIPPING",
        line1: deliveryAddress.line1,
        line2: deliveryAddress.line2 ?? null,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        postalCode: deliveryAddress.postalCode,
        ...(deliveryAddress.country ? { country: deliveryAddress.country } : {}),
        isDefault: !hasDefault,
      },
    });
  });
}

module.exports = { saveCheckoutDeliveryAddress };
