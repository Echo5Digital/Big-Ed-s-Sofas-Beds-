"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingCart, Check, Truck, Store } from "lucide-react";
import { stripInlineMarkdown } from "@big-eds/ui";
import { useDemoCart } from "@/components/layout/DemoCartProvider";

export default function ProductPurchasePanel({ product }) {
  const { addToCart } = useDemoCart();
  const activeVariants = product.variants.filter((v) => v.isActive);
  const [selectedVariantId, setSelectedVariantId] = useState(
    activeVariants[0]?.id ?? product.variants[0]?.id
  );
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState("delivery");
  const [justAdded, setJustAdded] = useState(false);

  const available = selectedVariant?.availability?.totalAvailable ?? 0;
  const canAddToCart = available > 0 && quantity <= available;

  function handleAddToCart() {
    if (!canAddToCart || !selectedVariant) return;
    addToCart(
      {
        id: product.id,
        variantId: selectedVariant.id,
        slug: product.slug,
        name: `${stripInlineMarkdown(product.name)} — ${selectedVariant.name}`,
        image: product.images[0]?.url ?? null,
        price: selectedVariant.priceCents / 100,
      },
      quantity
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  }

  return (
    <div className="flex flex-col gap-5">
      {product.variants.length > 1 && (
        <div>
          <span className="mb-2 block text-sm font-semibold text-brand-charcoal">Options</span>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedVariantId(variant.id)}
                disabled={!variant.isActive}
                aria-pressed={selectedVariantId === variant.id}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selectedVariantId === variant.id
                    ? "border-brand-red bg-brand-red/5 text-brand-red-dark"
                    : "border-brand-charcoal/20 text-brand-charcoal hover:border-brand-charcoal/40"
                }`}
              >
                {[variant.name, variant.color, variant.size].filter(Boolean).join(" / ")}
              </button>
            ))}
          </div>
        </div>
      )}

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
        disabled={!canAddToCart}
        className="hidden items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-charcoal/20 disabled:text-brand-charcoal/50 sm:flex"
      >
        {justAdded ? (
          <>
            <Check className="size-5 shrink-0" aria-hidden="true" />
            Added to Cart
          </>
        ) : (
          <>
            <ShoppingCart className="size-5 shrink-0" aria-hidden="true" />
            {available === 0 ? "Out of Stock" : "Add to Cart"}
          </>
        )}
      </button>

      {/* Sticky mobile add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-charcoal/10 bg-white/95 p-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-charcoal/20 disabled:text-brand-charcoal/50"
        >
          {justAdded ? (
            <>
              <Check className="size-5 shrink-0" aria-hidden="true" />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart className="size-5 shrink-0" aria-hidden="true" />
              {available === 0 ? "Out of Stock" : "Add to Cart"}
            </>
          )}
        </button>
      </div>
      {/* Spacer so sticky bar doesn't cover content on mobile */}
      <div className="h-16 sm:hidden" aria-hidden="true" />
    </div>
  );
}
