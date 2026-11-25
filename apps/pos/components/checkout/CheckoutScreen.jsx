"use client";

import { useEffect, useState } from "react";
import { LogOut, ShoppingCart, ChevronDown } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import { formatCents } from "@/lib/format";
import ProductSearch from "./ProductSearch";
import CartPanel from "./CartPanel";
import CustomerPanel from "./CustomerPanel";
import AttributionPanel from "./AttributionPanel";
import DeliveryAddressPanel from "./DeliveryAddressPanel";
import { EMPTY_ADDRESS } from "./AddressFields";
import TenderModal from "./TenderModal";
import CardCheckoutModal from "./CardCheckoutModal";
import ReceiptView from "./ReceiptView";
import CloseRegister from "../register/CloseRegister";

export default function CheckoutScreen() {
  const { session } = useRegisterSession();
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completedSale, setCompletedSale] = useState(null);
  // Set only while a CARD sale's Square Terminal checkout is awaiting the
  // customer's tap/insert/swipe (see CardCheckoutModal) — null the rest of
  // the time, including for every other tender method, which still resolve
  // synchronously within handleConfirmPayment itself.
  const [pendingCardOrderId, setPendingCardOrderId] = useState(null);
  const [costsByVariantId, setCostsByVariantId] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [requestedDeliveryAt, setRequestedDeliveryAt] = useState("");
  const [salesAttribution, setSalesAttribution] = useState([]);
  const [shippingAddress, setShippingAddress] = useState(EMPTY_ADDRESS);
  const [billingAddress, setBillingAddress] = useState(EMPTY_ADDRESS);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

  // Cost is fetched separately from the (unauthenticated, storefront-shared)
  // product search results — see GET /pos/cart-costs in pos.routes.js for
  // why this can't just ride along on ProductSearch's existing request.
  // Keyed by a stable, order-independent string of the cart's variant ids so
  // adding/removing quantity on an item already in the cart (not changing
  // which variants are present) doesn't re-fetch. No empty-cart branch
  // needed here: an empty cartVariantIdsKey just skips the fetch below, and
  // totalCostCents (computed from the current cart, not from this state
  // directly) naturally reads as 0 once cart is empty regardless of
  // whatever this map still holds from before the last item was removed.
  const cartVariantIdsKey = [...new Set(cart.map((l) => l.variantId))].sort().join(",");
  useEffect(() => {
    if (!cartVariantIdsKey) return;
    let cancelled = false;
    api
      .get(`/pos/cart-costs?variantIds=${encodeURIComponent(cartVariantIdsKey)}`)
      .then((data) => {
        if (!cancelled) setCostsByVariantId(data.costsByVariantId);
      })
      .catch(() => {
        // Non-fatal: the cart just shows no cost-floor warning for this
        // round of items — the server-side hard-block in ringSale is the
        // real guardrail and still applies regardless of this fetch.
      });
    return () => {
      cancelled = true;
    };
  }, [cartVariantIdsKey]);

  function handleAdd(row) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === row.variantId);
      if (existing) {
        if (existing.quantity >= row.totalAvailable) return prev;
        return prev.map((l) => (l.variantId === row.variantId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          variantId: row.variantId,
          productName: row.productName,
          variantName: row.variantName,
          priceCents: row.priceCents,
          compareAtCents: row.compareAtCents,
          taxRatePercent: row.taxRatePercent,
          imageUrl: row.imageUrl,
          quantity: 1,
          maxAvailable: row.totalAvailable,
        },
      ];
    });
    // On phones the cart is a collapsed drawer — surface it automatically so
    // adding an item doesn't feel like it silently did nothing.
    setCartOpen(true);
  }

  // Picking an existing customer (search) or creating a new one with an
  // address both resolve through the same CustomerPanel onSelect — prefill
  // billing (and, since billingSameAsShipping defaults true, shipping too)
  // from whatever address came back, same as a returning customer's address
  // auto-filling at online checkout. A customer with no address on file (or
  // "Remove customer") clears back to blank rather than leaving a stale
  // address from whoever was selected before.
  function handleSelectCustomer(customer) {
    setSelectedCustomer(customer);
    setBillingAddress(customer?.address ? { ...EMPTY_ADDRESS, ...customer.address } : EMPTY_ADDRESS);
    setBillingSameAsShipping(true);
  }

  function handleRemoveCustomer() {
    setSelectedCustomer(null);
    setBillingAddress(EMPTY_ADDRESS);
    setShippingAddress(EMPTY_ADDRESS);
    setBillingSameAsShipping(true);
  }

  function handleUpdateQuantity(variantId, quantity) {
    if (quantity <= 0) {
      handleRemove(variantId);
      return;
    }
    setCart((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, l.maxAvailable) } : l)));
  }

  function handleRemove(variantId) {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const subtotalCents = cart.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  // No discount has been entered yet at this point in the flow (that only
  // happens inside TenderModal), so this preview total can just add each
  // line's tax directly with no discount-proration step.
  const estimatedTaxCents = cart.reduce(
    (sum, l) => sum + Math.round((l.priceCents * l.quantity * Number(l.taxRatePercent ?? 0)) / 100),
    0
  );
  // Missing entries (cost not loaded yet, or costCents still null for that
  // variant) contribute 0 — same "only warn on a KNOWN loss" rule as the
  // server-side hard floor in pos.service.js's ringSale, so this preview
  // warning and the authoritative block never disagree about what counts.
  const totalCostCents = cart.reduce((sum, l) => sum + (costsByVariantId[l.variantId] ?? 0) * l.quantity, 0);

  // Address capture is optional — only send it when the cashier actually
  // typed something in, never the blank EMPTY_ADDRESS object (which would
  // fail posAddressInputSchema's required-field validation if sent as-is).
  function filledAddress(address) {
    return address.line1.trim() && address.city.trim() && address.state.trim() && address.postalCode.trim()
      ? address
      : undefined;
  }

  // Shared by a synchronous sale's success and a card sale's eventual
  // resolution (via CardCheckoutModal) — both start the next sale from the
  // same clean slate.
  function resetSaleForm() {
    setCartOpen(false);
    setCart([]);
    setSelectedCustomer(null);
    setRequestedDeliveryAt("");
    setShippingAddress(EMPTY_ADDRESS);
    setBillingAddress(EMPTY_ADDRESS);
    setBillingSameAsShipping(true);
    setSalesAttribution([]);
  }

  async function handleConfirmPayment({ payments, discount, discountReasonCode, pinOverride }) {
    setError(null);
    setSubmitting(true);
    try {
      const resolvedBillingAddress = filledAddress(billingAddress);
      // Only a fully-resolved attribution (every entry matched to a real
      // staff member) is sent — a lone unresolved entry is dropped
      // entirely, and a two-person split with one unresolved side is
      // dropped as a whole rather than silently becoming 100% credit to
      // whichever side did resolve.
      const resolvedAttribution =
        salesAttribution.length > 0 && salesAttribution.every((entry) => entry.userId) ? salesAttribution : [];
      const data = await api.post("/pos/sales", {
        registerSessionId: session.id,
        lines: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        payments,
        discount,
        discountReasonCode,
        pinOverride,
        salesAttribution: resolvedAttribution.length > 0 ? resolvedAttribution : undefined,
        requestedDeliveryAt: requestedDeliveryAt ? new Date(requestedDeliveryAt).toISOString() : undefined,
        billingAddress: resolvedBillingAddress,
        shippingAddress: resolvedBillingAddress && !billingSameAsShipping ? filledAddress(shippingAddress) : undefined,
        billingSameAsShipping: resolvedBillingAddress ? billingSameAsShipping : undefined,
        customerId: selectedCustomer?.id,
      });

      if (data.pending) {
        // Card sale: stays open on the register's cart/session (the cashier
        // can't ring up a second sale mid-wait — same single-register-at-a-
        // time model this whole screen already assumes) until
        // CardCheckoutModal's polling reports a resolution.
        setTenderOpen(false);
        setPendingCardOrderId(data.order.id);
        return;
      }

      setCompletedSale(data);
      setTenderOpen(false);
      resetSaleForm();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to complete sale");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCardResolved(data) {
    setPendingCardOrderId(null);
    if (data.canceled) {
      // Reopen the tender modal (rather than leaving no modal open at all)
      // so the error is actually visible and the cashier can immediately
      // retry with another tender — the cart/customer/etc. are all still
      // intact since resetSaleForm only ever runs on an actual success.
      setError(data.failureReason || "The card payment was not completed.");
      setTenderOpen(true);
      return;
    }
    setCompletedSale(data);
    resetSaleForm();
  }

  function handleCardCanceled() {
    setPendingCardOrderId(null);
    setError("Card payment canceled.");
    setTenderOpen(true);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col lg:flex-row">
      <div className="flex-1 overflow-hidden p-4 pb-20 sm:p-6 lg:pb-6">
        <ProductSearch onAdd={handleAdd} />
      </div>

      {/* Phones/small tablets: cart collapses behind a sticky summary bar so
          the product list stays reachable without scrolling past a full
          cart panel. Expands to a full-screen sheet on tap. */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        disabled={cart.length === 0}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-black/10 bg-brand-charcoal px-4 py-3.5 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.1)] disabled:opacity-60 lg:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="size-4" aria-hidden="true" />
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold">
          {formatCents(subtotalCents + estimatedTaxCents)}
          <ChevronDown className="size-4 rotate-180" aria-hidden="true" />
        </span>
      </button>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t border-black/10 bg-brand-cream p-4 shadow-xl transition-transform duration-200 sm:p-6 lg:static lg:z-auto lg:inset-auto lg:max-h-none lg:w-120 lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none ${
          cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
        }`}
      >
        <button
          type="button"
          onClick={() => setCartOpen(false)}
          aria-label="Collapse cart"
          className="mb-2 flex items-center justify-center lg:hidden"
        >
          <span className="h-1.5 w-12 rounded-full bg-black/15" />
        </button>

        <CustomerPanel
          customer={selectedCustomer}
          onSelect={handleSelectCustomer}
          onRemove={handleRemoveCustomer}
        />

        <AttributionPanel attribution={salesAttribution} onChange={setSalesAttribution} />

        <DeliveryAddressPanel
          shippingAddress={shippingAddress}
          onShippingChange={setShippingAddress}
          billingAddress={billingAddress}
          onBillingChange={setBillingAddress}
          billingSameAsShipping={billingSameAsShipping}
          onBillingSameAsShippingChange={setBillingSameAsShipping}
        />

        <CartPanel
          cart={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={handleRemove}
          onTakePayment={() => setTenderOpen(true)}
          requestedDeliveryAt={requestedDeliveryAt}
          onRequestedDeliveryAtChange={setRequestedDeliveryAt}
        />

        <button
          type="button"
          onClick={() => setCloseOpen(true)}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full border border-black/15 px-3 py-2 text-xs font-semibold text-brand-charcoal/70 hover:bg-black/5"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Close out register
        </button>
      </div>

      {cartOpen && (
        <button
          type="button"
          aria-label="Close cart"
          onClick={() => setCartOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <TenderModal
        open={tenderOpen}
        onClose={() => {
          setTenderOpen(false);
          setError(null);
        }}
        subtotalCents={subtotalCents}
        cart={cart}
        totalCostCents={totalCostCents}
        customer={selectedCustomer}
        onConfirm={handleConfirmPayment}
        submitting={submitting}
        error={error}
      />

      <CardCheckoutModal
        orderId={pendingCardOrderId}
        onResolved={handleCardResolved}
        onCancel={handleCardCanceled}
      />

      <ReceiptView open={Boolean(completedSale)} onClose={() => setCompletedSale(null)} sale={completedSale} />

      <CloseRegister open={closeOpen} onClose={() => setCloseOpen(false)} />
    </div>
  );
}
