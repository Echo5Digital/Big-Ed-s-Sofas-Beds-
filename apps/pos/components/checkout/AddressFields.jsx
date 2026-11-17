"use client";

// Shared address input set — same five fields/markup used by both
// CustomerPanel's NewCustomerForm and DeliveryAddressPanel, so the two don't
// drift on styling or field set.
export default function AddressFields({ value, onChange }) {
  function set(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        placeholder="Street address"
        value={value.line1}
        onChange={(e) => set("line1", e.target.value)}
        className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
      <input
        placeholder="Apt, suite, etc. (optional)"
        value={value.line2 ?? ""}
        onChange={(e) => set("line2", e.target.value)}
        className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          placeholder="City"
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
        <input
          placeholder="State"
          value={value.state}
          onChange={(e) => set("state", e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
        <input
          placeholder="ZIP"
          value={value.postalCode}
          onChange={(e) => set("postalCode", e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
      </div>
    </div>
  );
}

export const EMPTY_ADDRESS = { line1: "", line2: "", city: "", state: "", postalCode: "" };
