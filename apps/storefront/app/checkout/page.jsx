"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Truck, Store, ClipboardCheck, ShoppingBag, LogIn } from "lucide-react";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import AccountPanel from "@/components/account/AccountPanel";
import { useDemoCart } from "@/components/layout/DemoCartProvider";
import { formatCurrency } from "@/utils/formatCurrency";
import { api, ApiClientError } from "@/lib/api/client";
import { getCurrentCustomer } from "@/lib/api/customerAuth";
import { siteConfig } from "@/lib/mock-data/site-config";

export default function CheckoutPage() {
  const { cartItems, cartSubtotal, clearCart } = useDemoCart();
  const [fulfillment, setFulfillment] = useState("delivery");
  const [contact, setContact] = useState({ fullName: "", phone: "", email: "" });
  const [address, setAddress] = useState({ address1: "", address2: "", city: "", state: "", zip: "" });
  const [checkoutState, setCheckoutState] = useState("form"); // "form" | "payment" | "complete"
  const [order, setOrder] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [unavailableVariantIds, setUnavailableVariantIds] = useState([]);
  // "checking" | "signed-in" | "signed-out" — an account is required to reach
  // the checkout form itself (see the signed-out render below); this is a
  // storefront-only gate, the API's /checkout endpoint is unchanged and still
  // accepts guest orders from other channels (e.g. future POS/phone orders).
  const [authStatus, setAuthStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    getCurrentCustomer()
      .then((customer) => {
        if (!cancelled) setAuthStatus(customer ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (!cancelled) setAuthStatus("signed-out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setUnavailableVariantIds([]);
    setSubmitting(true);

    const [firstName, ...rest] = contact.fullName.trim().split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    try {
      const { order: createdOrder, paymentId: createdPaymentId } = await api.post("/checkout", {
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
      setPaymentId(createdPaymentId);
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
      <div className="pb-10">
        <Container className="mt-8">
          <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">Checkout</h1>
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

  if (checkoutState === "form" && authStatus !== "signed-in") {
    return (
      <div className="pb-10">
        <Container className="mt-8">
          <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">Checkout</h1>
          {authStatus === "checking" ? (
            <p role="status" aria-busy="true" className="mt-8 text-center text-sm text-brand-charcoal/60">
              Loading&hellip;
            </p>
          ) : (
            <>
              <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-2 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                  <LogIn className="size-6" aria-hidden="true" />
                </span>
                <h2 className="font-display text-xl font-bold text-brand-charcoal">
                  Sign In to Complete Your Order
                </h2>
                <p className="text-sm text-brand-charcoal/60">
                  Create a free account or sign in to place your order — it only takes a minute, and
                  you&rsquo;ll be able to track this order afterward.
                </p>
              </div>
              <div className="mt-6">
                <AccountPanel onSignedIn={() => setAuthStatus("signed-in")} />
              </div>
            </>
          )}
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

  if (checkoutState === "payment" && order && paymentId) {
    return (
      <div className="pb-10">
        <Container className="mt-8">
          <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">Payment</h1>
          <p className="mt-1.5 text-sm text-brand-charcoal/60">
            Order {order?.orderNumber} — {formatCurrency((order?.totalCents ?? 0) / 100)}
          </p>
          <div className="mt-6 max-w-lg">
            {process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ? (
              <PaymentForm
                orderId={order.id}
                paymentId={paymentId}
                onComplete={() => {
                  clearCart();
                  setCheckoutState("complete");
                }}
                onError={(msg) => setError(msg)}
              />
            ) : (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                Payment collection isn&rsquo;t configured on this environment
                (NEXT_PUBLIC_SQUARE_APPLICATION_ID is missing).
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </Container>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <Container className="mt-8">
        <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">Checkout</h1>
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
                  Pickup at {siteConfig.address.line1}, {siteConfig.address.line2}. We&rsquo;ll call or email
                  to schedule a pickup window once your order is ready.
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
              <span className="text-brand-charcoal/70">Subtotal (tax included)</span>
              <span className="font-semibold text-brand-charcoal">{formatCurrency(cartSubtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-brand-charcoal/50">
              Delivery fees are confirmed by our team before final payment.
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

// Square Web Payments SDK is loaded via a <script> tag injected at runtime.
// We dynamically import it here on the client so SSR never tries to execute
// browser-only Square globals. The card payment form is mounted into a div
// that Square's SDK owns — we keep a ref to that container div and call
// card.attach() once the SDK has loaded.
function PaymentForm({ orderId, paymentId, onComplete, onError }) {
  const cardContainerRef = useRef(null);
  const cardRef = useRef(null);
  const paymentsRef = useRef(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    let destroyed = false;

    async function initSquare() {
      // Square Web Payments SDK must be loaded via their CDN script.
      // Load it programmatically if not already present.
      if (!window.Square) {
        await new Promise((resolve, reject) => {
          const existing = document.getElementById("square-web-payments-sdk");
          if (existing) {
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.id = "square-web-payments-sdk";
          script.src =
            process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production"
              ? "https://web.squarecdn.com/v1/square.js"
              : "https://sandbox.web.squarecdn.com/v1/square.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load Square Web Payments SDK"));
          document.head.appendChild(script);
        });
      }

      if (destroyed) return;

      const payments = window.Square.payments(
        process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID,
        process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID
      );
      paymentsRef.current = payments;

      const card = await payments.card();
      if (destroyed) {
        await card.destroy();
        return;
      }
      cardRef.current = card;
      await card.attach(cardContainerRef.current);
      setSdkReady(true);
    }

    initSquare().catch((err) => {
      if (!destroyed) {
        setLocalError(err.message || "Failed to initialize payment form.");
      }
    });

    return () => {
      destroyed = true;
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => {});
        cardRef.current = null;
      }
    };
  }, []);

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    if (!cardRef.current || submitting) return;
    setSubmitting(true);
    setLocalError(null);

    let tokenResult;
    try {
      tokenResult = await cardRef.current.tokenize();
    } catch (err) {
      setLocalError(err.message || "Card tokenization failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (tokenResult.status !== "OK") {
      const msg =
        tokenResult.errors?.map((e) => e.message).join(" ") ||
        "Card tokenization failed. Please check your card details.";
      setLocalError(msg);
      setSubmitting(false);
      return;
    }

    try {
      await api.post(`/checkout/${orderId}/pay`, { sourceId: tokenResult.token });
      onComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "Payment failed. Please try again.";
      setLocalError(msg);
      onError(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4">
      {/* Square mounts its card fields into this div */}
      <div ref={cardContainerRef} id="square-card-container" />
      {!sdkReady && !localError && (
        <p className="text-sm text-brand-charcoal/50">Loading payment form…</p>
      )}
      {localError && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError}
        </p>
      )}
      <button
        type="submit"
        disabled={!sdkReady || submitting}
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
