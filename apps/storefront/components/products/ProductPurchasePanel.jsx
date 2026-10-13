"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingCart, Check, Truck, Store } from "lucide-react";
import { useDemoCart } from "@/components/layout/DemoCartProvider";

export default function ProductPurchasePanel({ product }) {
  const { addToCart } = useDemoCart();
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState("delivery");
  const [justAdded, setJustAdded] = useState(false);

  function handleAddToCart() {
    addToCart(product, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="mb-2 block text-sm font-semibold text-brand-charcoal">Quantity</span>
        <div className="inline-flex items-center rounded-full border border-brand-charcoal/20 bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="flex size-10 items-center justify-center rounded-full text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="w-10 text-center text-sm font-semibold text-brand-charcoal" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            aria-label="Increase quantity"
            className="flex size-10 items-center justify-center rounded-full text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-semibold text-brand-charcoal">
          Delivery or Pickup
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFulfillment("delivery")}
            aria-pressed={fulfillment === "delivery"}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
              fulfillment === "delivery"
                ? "border-brand-red bg-brand-red/5 text-brand-red-dark"
                : "border-brand-charcoal/20 text-brand-charcoal hover:border-brand-charcoal/40"
            }`}
          >
            <Truck className="size-4 shrink-0" aria-hidden="true" />
            Local Delivery
          </button>
          <button
            type="button"
            onClick={() => setFulfillment("pickup")}
            aria-pressed={fulfillment === "pickup"}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
              fulfillment === "pickup"
                ? "border-brand-red bg-brand-red/5 text-brand-red-dark"
                : "border-brand-charcoal/20 text-brand-charcoal hover:border-brand-charcoal/40"
            }`}
          >
            <Store className="size-4 shrink-0" aria-hidden="true" />
            Showroom Pickup
          </button>
        </div>
        <p className="mt-1.5 text-xs text-brand-charcoal/50">
          {fulfillment === "delivery"
            ? "Delivery fees and scheduling are confirmed at checkout — final rates depend on your address."
            : "Pick up at our Lake Wales showroom once your order is ready. We'll contact you to schedule a time."}
        </p>
      </div>

      {/* Desktop/tablet add-to-cart. Hidden on small screens in favor of the sticky mobile bar. */}
      <button
        type="button"
        onClick={handleAddToCart}
        className="hidden items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark sm:flex"
      >
        {justAdded ? (
          <>
            <Check className="size-5 shrink-0" aria-hidden="true" />
            Added to Cart
          </>
        ) : (
          <>
            <ShoppingCart className="size-5 shrink-0" aria-hidden="true" />
            Add to Cart
          </>
        )}
      </button>

      {/* Sticky mobile add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-charcoal/10 bg-white/95 p-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={handleAddToCart}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
        >
          {justAdded ? (
            <>
              <Check className="size-5 shrink-0" aria-hidden="true" />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart className="size-5 shrink-0" aria-hidden="true" />
              Add to Cart
            </>
          )}
        </button>
      </div>
      {/* Spacer so sticky bar doesn't cover content on mobile */}
      <div className="h-16 sm:hidden" aria-hidden="true" />
    </div>
  );
}
