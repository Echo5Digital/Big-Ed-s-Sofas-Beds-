"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Truck, Store, ClipboardCheck, ShoppingBag } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import { useDemoCart } from "@/components/layout/DemoCartProvider";
import { formatCurrency } from "@/utils/formatCurrency";
import { api, ApiClientError } from "@/lib/api/client";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function CheckoutPage() {
  const { cartItems, cartSubtotal, clearCart } = useDemoCart();
  const [fulfillment, setFulfillment] = useState("delivery");
  const [contact, setContact] = useState({ fullName: "", phone: "", email: "" });
  const [address, setAddress] = useState({ address1: "", address2: "", city: "", state: "", zip: "" });
  const [checkoutState, setCheckoutState] = useState("form"); // "form" | "payment" | "complete"
  const [clientSecret, setClientSecret] = useState(null);
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [unavailableVariantIds, setUnavailableVariantIds] = useState([]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setUnavailableVariantIds([]);
    setSubmitting(true);

    const [firstName, ...rest] = contact.fullName.trim().split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    try {
      const { order: createdOrder, clientSecret: secret } = await api.post("/checkout", {
        lines: cartItems.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        fulfillmentMethod: fulfillment === "delivery" ? "DELIVERY" : "PICKUP",
        customer: {
          email: contact.email,
          firstName: firstName || contact.fullName,
          lastName,
          phone: contact.phone || null,
        },
        deliveryAddress:
          fulfillment === "delivery"
            ? {
                line1: address.address1,
                line2: address.address2 || null,
                city: address.city,
                state: address.state,
                postalCode: address.zip,
              }
            : null,
      });

      setOrder(createdOrder);
      setClientSecret(secret);
      setCheckoutState("payment");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setUnavailableVariantIds(err.details?.unavailableVariantIds ?? []);
      } else {
        setError("Something went wrong placing your order. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (cartItems.length === 0 && checkoutState === "form") {
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

  if (checkoutState === "complete") {
    return (
      <div className="py-8 sm:py-10">
        <Container>
          <div className="mx-auto max-w-lg rounded-2xl border border-brand-gold/40 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold-dark">
              <ClipboardCheck className="size-7" aria-hidden="true" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-brand-charcoal">
              Payment Submitted
            </h1>
            <p className="mt-2 text-sm text-brand-charcoal/70">
              Order <strong>{order?.orderNumber}</strong> is confirmed and your payment is processing.
              You&rsquo;ll receive a confirmation once it clears — this can take a few seconds.
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

  if (checkoutState === "payment" && clientSecret) {
    return (
      <div className="py-8 sm:py-10">
        <Container>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
          <h1 className="mt-4 font-display text-3xl font-bold text-brand-charcoal sm:text-4xl">
            Payment
          </h1>
          <p className="mt-1 text-sm text-brand-charcoal/60">
            Order {order?.orderNumber} — {formatCurrency((order?.totalCents ?? 0) / 100)}
          </p>

          <div className="mt-6 max-w-lg">
            {stripePromise ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  onComplete={() => {
                    clearCart();
                    setCheckoutState("complete");
                  }}
                />
              </Elements>
            ) : (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                Payment collection isn&rsquo;t configured on this environment
                (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing).
              </p>
            )}
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

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            {unavailableVariantIds.length > 0 && " Please update your cart and try again."}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <fieldset className="rounded-xl border border-brand-charcoal/10 bg-white p-5">
              <legend className="px-1 font-display text-lg font-semibold text-brand-charcoal">
                Contact Information
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Full Name"
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  value={contact.fullName}
                  onChange={(value) => setContact((c) => ({ ...c, fullName: value }))}
                />
                <Field
                  label="Phone"
                  id="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={contact.phone}
                  onChange={(value) => setContact((c) => ({ ...c, phone: value }))}
                />
                <Field
                  label="Email"
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="sm:col-span-2"
                  value={contact.email}
                  onChange={(value) => setContact((c) => ({ ...c, email: value }))}
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
                  <Field
                    label="Street Address"
                    id="address1"
                    type="text"
                    required
                    className="sm:col-span-2"
                    value={address.address1}
                    onChange={(value) => setAddress((a) => ({ ...a, address1: value }))}
                  />
                  <Field
                    label="Apt / Unit (optional)"
                    id="address2"
                    type="text"
                    value={address.address2}
                    onChange={(value) => setAddress((a) => ({ ...a, address2: value }))}
                  />
                  <Field
                    label="City"
                    id="city"
                    type="text"
                    required
                    value={address.city}
                    onChange={(value) => setAddress((a) => ({ ...a, city: value }))}
                  />
                  <Field
                    label="State"
                    id="state"
                    type="text"
                    required
                    value={address.state}
                    onChange={(value) => setAddress((a) => ({ ...a, state: value }))}
                  />
                  <Field
                    label="ZIP Code"
                    id="zip"
                    type="text"
                    required
                    value={address.zip}
                    onChange={(value) => setAddress((a) => ({ ...a, zip: value }))}
                  />
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
              <p className="mt-3 rounded-lg bg-brand-cream px-4 py-3 text-sm text-brand-charcoal/70">
                Card details are collected securely on the next step after your order is created.
              </p>
            </fieldset>
          </div>

          <div className="h-fit rounded-xl border border-brand-charcoal/10 bg-white p-5">
            <h2 className="font-display text-lg font-semibold text-brand-charcoal">Order Summary</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {cartItems.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-brand-cream">
                    {item.image && (
                      <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="line-clamp-1 text-sm font-semibold text-brand-charcoal">{item.name}</p>
                    <p className="text-xs text-brand-charcoal/50">
                      Qty {item.quantity}
                      {unavailableVariantIds.includes(item.variantId) && (
                        <span className="ml-1 font-semibold text-brand-red-dark">— out of stock</span>
                      )}
                    </p>
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
              disabled={submitting}
              className="mt-5 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:opacity-60"
            >
              {submitting ? "Placing Order…" : "Continue to Payment"}
            </button>
          </div>
        </form>
      </Container>
    </div>
  );
}

function PaymentForm({ onComplete }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed. Please check your card details and try again.");
      setSubmitting(false);
      return;
    }

    onComplete();
  }

  return (
    <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60"
      >
        {submitting ? "Processing…" : "Pay Now"}
      </button>
    </form>
  );
}

function Field({ label, id, type, required, autoComplete, className = "", value, onChange }) {
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
      />
    </div>
  );
}
