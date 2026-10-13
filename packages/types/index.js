// JSDoc-only shared shape definitions (plain JavaScript, no TypeScript build step).
// These exist for editor intellisense/documentation, not runtime behavior.

/**
 * @typedef {Object} MoneyAmount
 * @property {number} cents
 * @property {string} formatted
 */

/**
 * @typedef {"DRAFT"|"CONFIRMED"|"CANCELED"|"CLOSED"} OrderStatus
 * @typedef {"UNPAID"|"PARTIALLY_PAID"|"PAID"|"REFUNDED"} PaymentStatus
 * @typedef {"UNALLOCATED"|"RESERVED"|"READY"|"PICKED_UP"|"DELIVERED"} FulfillmentStatus
 */

module.exports = {};
