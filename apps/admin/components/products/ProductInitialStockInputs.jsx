"use client";

// Counts entered here become a real stock receipt on submit (POST
// /catalog/products' initialStock field, applied via
// inventoryService.adjustStock — see apps/api/src/routes/catalog.routes.js),
// not a cosmetic number: each nonzero count writes a StockMovement and shows
// up immediately on the Inventory page for this product's variant. Locations
// are fetched live from GET /inventory/locations rather than hardcoded, so
// this reflects whatever Showroom/Warehouse (or future) locations actually
// exist.
export default function ProductInitialStockInputs({ locations, quantities, onChange }) {
  function setQuantity(locationId, value) {
    onChange({ ...quantities, [locationId]: value });
  }

  if (locations.length === 0) {
    return <p className="text-sm text-brand-charcoal/60">No active locations configured yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {locations.map((location) => (
        <div key={location.id} className="flex flex-col gap-1.5">
          <label htmlFor={`stock-${location.id}`} className="text-sm font-medium text-brand-charcoal">
            {location.name}
          </label>
          <input
            id={`stock-${location.id}`}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={quantities[location.id] ?? ""}
            onChange={(e) => setQuantity(location.id, e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      ))}
    </div>
  );
}
