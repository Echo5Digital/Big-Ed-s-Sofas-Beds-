"use client";

import { useState } from "react";
import { LogOut, ShoppingCart, ChevronDown } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import { formatCents } from "@/lib/format";
import ProductSearch from "./ProductSearch";
import CartPanel from "./CartPanel";
import TenderModal from "./TenderModal";
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
          quantity: 1,
          maxAvailable: row.totalAvailable,
        },
      ];
    });
    // On phones the cart is a collapsed drawer — surface it automatically so
    // adding an item doesn't feel like it silently did nothing.
    setCartOpen(true);
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

  async function handleConfirmPayment({ tenderMethod, tenderedCents, depositAmountCents, discountCents, discountReasonCode }) {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post("/pos/sales", {
        registerSessionId: session.id,
        lines: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        tenderMethod,
        tenderedCents,
        depositAmountCents,
        discountCents,
        discountReasonCode,
      });
      setCompletedSale(data);
      setTenderOpen(false);
      setCartOpen(false);
      setCart([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to complete sale");
    } finally {
      setSubmitting(false);
    }
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
          {formatCents(subtotalCents)}
          <ChevronDown className="size-4 rotate-180" aria-hidden="true" />
        </span>
      </button>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t border-black/10 bg-brand-cream p-4 shadow-xl transition-transform duration-200 sm:p-6 lg:static lg:z-auto lg:inset-auto lg:max-h-none lg:w-96 lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none ${
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

        <CartPanel
          cart={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={handleRemove}
          onTakePayment={() => setTenderOpen(true)}
          subtotalCents={subtotalCents}
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
        onConfirm={handleConfirmPayment}
        submitting={submitting}
        error={error}
      />

      <ReceiptView open={Boolean(completedSale)} onClose={() => setCompletedSale(null)} sale={completedSale} />

      <CloseRegister open={closeOpen} onClose={() => setCloseOpen(false)} />
    </div>
  );
}
