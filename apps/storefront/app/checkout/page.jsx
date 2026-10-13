"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Truck, Store, ClipboardCheck, ShoppingBag } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import { useDemoCart } from "@/components/layout/DemoCartProvider";
import { formatCurrency } from "@/utils/formatCurrency";

export default function CheckoutPage() {
  const { cartItems, cartSubtotal } = useDemoCart();
  const [fulfillment, setFulfillment] = useState("delivery");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    // Demo-only: no payment processor or order API is wired up yet.
    setSubmitted(true);
  }

  if (cartItems.length === 0 && !submitted) {
    return (
      <div className="py-8 sm:py-10">
        <Container>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Checkout" }]} />
          <div className="mt-8">
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Add a few items to your cart before heading to checkout."
              actionLabel="Shop Furniture"
              actionHref="/shop"
            />
          </div>
        </Container>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="py-8 sm:py-10">
        <Container>
          <div className="mx-auto max-w-lg rounded-2xl border border-brand-gold/40 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold-dark">
              <ClipboardCheck className="size-7" aria-hidden="true" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-brand-charcoal">
              Order Review Received
            </h1>
            <p className="mt-2 text-sm text-brand-charcoal/70">
              This is a demo storefront — <strong>payment integration is coming soon</strong>. No
              real order has been placed and no payment was collected. A member of the Big Ed&rsquo;s
              team would normally follow up to confirm details and finalize payment.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark"
            >
              Continue Shopping
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-8 sm:py-10">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />

        <h1 className="mt-4 font-display text-3xl font-bold text-brand-charcoal sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-brand-charcoal/60">
          Demo checkout — review-only. No payment is collected on this site yet.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <fieldset className="rounded-xl border border-brand-charcoal/10 bg-white p-5">
              <legend className="px-1 font-display text-lg font-semibold text-brand-charcoal">
                Contact Information
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name" id="fullName" type="text" required autoComplete="name" />
                <Field label="Phone" id="phone" type="tel" required autoComplete="tel" />
                <Field
                  label="Email"
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="sm:col-span-2"
                />
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-brand-charcoal/10 bg-white p-5">
              <legend className="px-1 font-display text-lg font-semibold text-brand-charcoal">
                Delivery or Pickup
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setFulfillment("delivery")}
                  aria-pressed={fulfillment === "delivery"}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
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
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                    fulfillment === "pickup"
                      ? "border-brand-red bg-brand-red/5 text-brand-red-dark"
                      : "border-brand-charcoal/20 text-brand-charcoal hover:border-brand-charcoal/40"
                  }`}
                >
                  <Store className="size-4 shrink-0" aria-hidden="true" />
                  Showroom Pickup
                </button>
              </div>

              {fulfillment === "delivery" && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Street Address" id="address1" type="text" required className="sm:col-span-2" />
                  <Field label="Apt / Unit (optional)" id="address2" type="text" />
                  <Field label="City" id="city" type="text" required />
                  <Field label="State" id="state" type="text" required />
                  <Field label="ZIP Code" id="zip" type="text" required />
                </div>
              )}

              {fulfillment === "pickup" && (
                <p className="mt-4 rounded-lg bg-brand-cream px-4 py-3 text-sm text-brand-charcoal/70">
                  Pickup at 17535 US Highway 27, Lake Wales, FL 33853. We&rsquo;ll call or email to
                  schedule a pickup window once your order is ready.
                </p>
              )}
            </fieldset>

            <fieldset className="rounded-xl border border-brand-charcoal/10 bg-white p-5">
              <legend className="px-1 font-display text-lg font-semibold text-brand-charcoal">
                Payment
              </legend>
              <p className="mt-3 rounded-lg bg-brand-gold/15 px-4 py-3 text-sm text-brand-charcoal/80">
                Payment integration is coming soon. Submitting this form will not charge a card or
                place a real order &mdash; it only demonstrates the checkout flow.
              </p>
            </fieldset>
          </div>

          <div className="h-fit rounded-xl border border-brand-charcoal/10 bg-white p-5">
            <h2 className="font-display text-lg font-semibold text-brand-charcoal">Order Summary</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {cartItems.map((item) => (
                <li key={item.productId} className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-brand-cream">
                    <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="line-clamp-1 text-sm font-semibold text-brand-charcoal">{item.name}</p>
                    <p className="text-xs text-brand-charcoal/50">Qty {item.quantity}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-brand-charcoal">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-brand-charcoal/10 pt-4 text-sm">
              <span className="text-brand-charcoal/70">Subtotal</span>
              <span className="font-semibold text-brand-charcoal">{formatCurrency(cartSubtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-brand-charcoal/50">
              Delivery fees and tax are confirmed by our team before final payment.
            </p>
            <button
              type="submit"
              className="mt-5 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
            >
              Review Order
            </button>
          </div>
        </form>
      </Container>
    </div>
  );
}

function Field({ label, id, type, required, autoComplete, className = "" }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
      />
    </div>
  );
}
