// Shared sessionStorage key for handing a low-stock selection off from
// /inventory to /purchasing/new — an arbitrary-length list of lines isn't
// reliable to carry in a query string, and this is the only two call sites
// that need to agree on where it lives.
export const INVENTORY_TO_PO_STORAGE_KEY = "big-eds:inventory-to-po";
