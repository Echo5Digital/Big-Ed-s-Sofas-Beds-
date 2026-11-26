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
import { getProfile, listAddresses } from "@/lib/api/customerAccount";
import { siteConfig } from "@/lib/mock-data/site-config";

const NEW_ADDRESS_OPTION = "__new__";

function addressToFormFields(address) {
  return {
    address1: address.line1 ?? "",
    address2: address.line2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    zip: address.postalCode ?? "",
  };
}

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
  // The signed-in customer's saved addresses, and which one is currently
  // selected in the picker — NEW_ADDRESS_OPTION means "typing a fresh one",
  // distinct from having zero saved addresses (same blank form, but no
  // picker shown at all in that case).
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(NEW_ADDRESS_OPTION);
  const [saveNewAddress, setSaveNewAddress] = useState(false);

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

  // Once signed in, prefill contact info from the account profile and the
  // address form from the default saved address (if any) — a returning
  // customer shouldn't have to retype what's already on file. Guarded on
  // authStatus (not just "run once on mount") since authStatus flips from
  // "checking" to "signed-in" asynchronously above.
  useEffect(() => {
    if (authStatus !== "signed-in") return;
    let cancelled = false;
    Promise.all([getProfile(), listAddresses()])
      .then(([profile, addresses]) => {
        if (cancelled) return;
        setContact({
          fullName: [profile.firstName, profile.lastName].filter(Boolean).join(" "),
          phone: profile.phone ?? "",
          email: profile.email ?? "",
        });
        setSavedAddresses(addresses);
        const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          setAddress(addressToFormFields(defaultAddress));
        }
      })
      .catch(() => {
        // Non-fatal: the form just stays blank, same as a guest's would —
        // nothing here blocks placing the order.
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  function handleAddressSelect(addressId) {
    setSelectedAddressId(addressId);
    setSaveNewAddress(false);
    if (addressId === NEW_ADDRESS_OPTION) {
      setAddress({ address1: "", address2: "", city: "", state: "", zip: "" });
      return;
    }
    const picked = savedAddresses.find((a) => a.id === addressId);
    if (picked) setAddress(addressToFormFields(picked));
  }

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

      // No separate "save to address book" call here: POST /checkout's own
      // saveCheckoutDeliveryAddress (orders.service.js) already links the
      // exact same address data to this customer, deduped against their
      // existing addresses. A second, independent createAddress call here
      // used to race that same-moment save — two concurrent transactions,
      // each checking "does a duplicate exist?" before the other had
      // committed, so both decided no and inserted — producing two rows for
      // the same real-world address every time "Save this address" was
      // checked. The checkbox and saveNewAddress state are left in place for
      // now (unchanged markup below) since removing them is a separate,
      // bigger behavior change than fixing the duplication itself.

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
    // A declined/failed charge already cancels this order server-side (see
    // orders.routes.js's /checkout/:id/pay -> markPaymentFailed, which
    // releases the reservation and sets Order -> CANCELED) — there is no
    // "retry the same order" path, so both Cancel and a failed payment send
    // the shopper back to the checkout form to place a fresh order. The cart
    // itself is untouched here (only onComplete's success path clears it),
    // so nothing the shopper already entered is lost.
    function handleBackToCheckout() {
      setOrder(null);
      setPaymentId(null);
      setError(null);
      setCheckoutState("form");
    }

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
                amountCents={order.totalCents ?? 0}
                billingContact={{
                  fullName: contact.fullName,
                  address: fulfillment === "delivery" ? address : null,
                }}
                onComplete={() => {
                  clearCart();
                  setCheckoutState("complete");
                }}
                onCancel={handleBackToCheckout}
              />
            ) : (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                Payment collection isn&rsquo;t configured on this environment
                (NEXT_PUBLIC_SQUARE_APPLICATION_ID is missing).
              </p>
            )}
          </div>
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
                <>
                  {savedAddresses.length > 0 && (
                    <div className="mt-4 flex flex-col gap-2">
                      <p className="text-sm font-semibold text-brand-charcoal">Choose a delivery address</p>
                      <div className="flex flex-col gap-2">
                        {savedAddresses.map((saved) => (
                          <label
                            key={saved.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                              selectedAddressId === saved.id
                                ? "border-brand-red bg-brand-red/5"
                                : "border-brand-charcoal/15 hover:border-brand-charcoal/30"
                            }`}
                          >
                            <input
                              type="radio"
                              name="savedAddress"
                              checked={selectedAddressId === saved.id}
                              onChange={() => handleAddressSelect(saved.id)}
                              className="mt-0.5 accent-brand-red"
                            />
                            <span className="text-brand-charcoal/80">
                              {saved.line1}
                              {saved.line2 ? `, ${saved.line2}` : ""}, {saved.city}, {saved.state}{" "}
                              {saved.postalCode}
                              {saved.isDefault && (
                                <span className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-brand-red-dark">
                                  Default
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                        <label
                          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                            selectedAddressId === NEW_ADDRESS_OPTION
                              ? "border-brand-red bg-brand-red/5 text-brand-red-dark"
                              : "border-brand-charcoal/15 text-brand-charcoal hover:border-brand-charcoal/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name="savedAddress"
                            checked={selectedAddressId === NEW_ADDRESS_OPTION}
                            onChange={() => handleAddressSelect(NEW_ADDRESS_OPTION)}
                            className="accent-brand-red"
                          />
                          Enter a new address
                        </label>
                      </div>
                    </div>
                  )}

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

                  {authStatus === "signed-in" && selectedAddressId === NEW_ADDRESS_OPTION && (
                    <label className="mt-3 flex items-center gap-2 text-sm font-medium text-brand-charcoal">
                      <input
                        type="checkbox"
                        checked={saveNewAddress}
                        onChange={(e) => setSaveNewAddress(e.target.checked)}
                        className="size-4 accent-brand-red"
                      />
                      Save this address to my account
                    </label>
                  )}
                </>
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
// Builds Square's billingContact shape for verifyBuyer() from whatever this
// checkout already collected — never a separate billing-address form of its
// own. A pickup order has no address at all (see CheckoutPage's fulfillment
// branch), so this degrades to name-only rather than fabricating an address;
// Square's buyer verification accepts a partial billingContact.
function buildBillingContact({ fullName, address }) {
  const [givenName, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
  const contact = {};
  if (givenName) contact.givenName = givenName;
  if (rest.length > 0) contact.familyName = rest.join(" ");
  if (address?.address1) {
    contact.addressLines = [address.address1, address.address2].filter(Boolean);
    contact.city = address.city || undefined;
    contact.state = address.state || undefined;
    contact.postalCode = address.zip || undefined;
    contact.countryCode = "US";
  }
  return contact;
}

function PaymentForm({ orderId, paymentId, amountCents, billingContact, onComplete, onCancel }) {
  const cardContainerRef = useRef(null);
  const cardRef = useRef(null);
  const paymentsRef = useRef(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  // A declined/failed charge already cancels this order and releases its
  // stock reservation server-side (orders.routes.js's /checkout/:id/pay ->
  // markPaymentFailed) — retrying Pay Now against the same orderId would
  // only ever hit "This order has no payment awaiting charge" (the payment
  // row is no longer PENDING). So once a real decline comes back from the
  // server (not a client-side tokenization error, which is just a bad card
  // number/expiry and is still retryable), Pay Now is retired in favor of
  // Cancel, which sends the shopper back to place a fresh order.
  const [declined, setDeclined] = useState(false);

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

    // Buyer verification is a separate step from tokenization — this is what
    // actually presents the card issuer's 3D Secure / SCA challenge (an OTP
    // text, or an approval prompt in the customer's banking app) when their
    // bank requires one, and produces the verificationToken CreatePayment
    // needs to prove it happened. Square test cards in sandbox never trigger
    // a real challenge, which is why this step could be skipped entirely
    // before and still look like it worked in every sandbox test.
    let verificationToken;
    try {
      const verification = await paymentsRef.current.verifyBuyer(tokenResult.token, {
        amount: (amountCents / 100).toFixed(2),
        currencyCode: "USD",
        intent: "CHARGE",
        billingContact: buildBillingContact(billingContact),
      });
      verificationToken = verification?.token;
    } catch (err) {
      setLocalError(err.message || "Card verification failed. Please try again.");
      setSubmitting(false);
      return;
    }

    try {
      await api.post(`/checkout/${orderId}/pay`, { sourceId: tokenResult.token, verificationToken });
      onComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "Payment failed. Please try again.";
      setLocalError(msg);
      setDeclined(true);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handlePaymentSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-brand-charcoal/10 bg-white p-5 shadow-sm"
    >
      {/* Square mounts its card fields into this div */}
      <div
        ref={cardContainerRef}
        id="square-card-container"
        className="rounded-lg border border-brand-charcoal/20 bg-white px-1 py-1 transition-colors focus-within:border-brand-red"
      />
      {!sdkReady && !localError && (
        <p className="text-sm text-brand-charcoal/50">Loading payment form…</p>
      )}
      {localError && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={!sdkReady || submitting || declined}
          className="flex-1 rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60"
        >
          {submitting ? "Processing…" : "Pay Now"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-brand-charcoal/20 px-6 py-3 text-sm font-semibold text-brand-charcoal transition-colors hover:border-brand-charcoal/40 hover:bg-brand-charcoal/5"
        >
          Cancel
        </button>
      </div>
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
