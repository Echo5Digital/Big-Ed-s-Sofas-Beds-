const RESERVATION_TTL_MINUTES = 30;

// A balance at or below this available-to-sell count is flagged low-stock on
// the inventory report; the suggested reorder quantity tops back up to 2x
// this threshold.
const LOW_STOCK_THRESHOLD = 2;

const ROLE_PERMISSIONS_BY_DEFAULT = {
  ADMIN: "all",
  MANAGER: "operational",
  STAFF: "readonly-plus-receiving",
};

const STOCK_MOVEMENT_TYPES = [
  "RECEIPT",
  "SALE",
  "RETURN_RESTOCK",
  "RETURN_QUARANTINE",
  "ADJUSTMENT_INCREASE",
  "ADJUSTMENT_DECREASE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "RESERVATION_CONVERT",
  "RESERVATION_RELEASE",
];

module.exports = {
  RESERVATION_TTL_MINUTES,
  LOW_STOCK_THRESHOLD,
  ROLE_PERMISSIONS_BY_DEFAULT,
  STOCK_MOVEMENT_TYPES,
};
