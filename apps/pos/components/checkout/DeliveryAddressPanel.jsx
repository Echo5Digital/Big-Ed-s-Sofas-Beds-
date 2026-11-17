"use client";

import { MapPin } from "lucide-react";
import AddressFields from "./AddressFields";

// Always visible on the checkout sidebar — address capture is purely
// informational (for the receipt), independent of fulfillment method.
// Billing is captured first, then shipping — with a "shipping same as
// billing" shortcut, since the billing address is usually the one already
// on file / on the card. Both are optional; the server only creates
// Address snapshot rows when a billing address was actually filled in.
export default function DeliveryAddressPanel({
  shippingAddress,
  onShippingChange,
  billingAddress,
  onBillingChange,
  billingSameAsShipping,
  onBillingSameAsShippingChange,
}) {
  return (
    <div className="mb-3 rounded-lg bg-brand-cream/70 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
        <MapPin className="size-3.5" aria-hidden="true" />
        Customer address
      </p>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-brand-charcoal/40">Billing address</p>
        <AddressFields value={billingAddress} onChange={onBillingChange} />

        <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
          <input
            type="checkbox"
            checked={billingSameAsShipping}
            onChange={(e) => onBillingSameAsShippingChange(e.target.checked)}
            className="size-4 accent-brand-red"
          />
          Delivery address same as billing
        </label>

        {!billingSameAsShipping && (
          <>
            <p className="text-xs font-medium text-brand-charcoal/40">Delivery address</p>
            <AddressFields value={shippingAddress} onChange={onShippingChange} />
          </>
        )}
      </div>
    </div>
  );
}
