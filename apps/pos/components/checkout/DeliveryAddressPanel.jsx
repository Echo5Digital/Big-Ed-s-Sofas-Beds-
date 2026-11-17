"use client";

import { Truck } from "lucide-react";
import AddressFields from "./AddressFields";

// Only rendered when fulfillmentMethod === "DELIVERY" (CheckoutScreen
// handles that condition) — in-store pickup/carry-out sales have nothing to
// ship, so this step is skipped entirely for them. Billing is captured
// first, then shipping — with a "shipping same as billing" shortcut, since
// the billing address is usually the one already on file / on the card.
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
        <Truck className="size-3.5" aria-hidden="true" />
        Delivery address
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
          Shipping address same as billing
        </label>

        {!billingSameAsShipping && (
          <>
            <p className="text-xs font-medium text-brand-charcoal/40">Shipping address</p>
            <AddressFields value={shippingAddress} onChange={onShippingChange} />
          </>
        )}
      </div>
    </div>
  );
}
