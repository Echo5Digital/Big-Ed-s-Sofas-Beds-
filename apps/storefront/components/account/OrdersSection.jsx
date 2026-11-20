"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package, ChevronDown, MapPin, CreditCard, FileDown, CheckCircle2 } from "lucide-react";
import { listOrders, isSessionExpired } from "@/lib/api/customerAccount";
import { Notice, describeError, linkButtonClass, secondaryButtonClass } from "@/components/account/formParts";
import { formatCurrency } from "@/utils/formatCurrency";
import { buildInvoiceHtml } from "@/components/account/orderInvoice";

const PAGE_SIZE = 10;

const money = (cents) => formatCurrency(cents / 100);

const FULFILLMENT_METHOD_LABEL = {
  PICKUP: "Store pickup",
  DELIVERY: "Delivery",
  IN_STORE: "Bought in store",
};

const PAYMENT_LABEL = {
  UNPAID: "Payment pending",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

const PAYMENT_METHOD_LABEL = {
  CASH: "Cash",
  CARD: "Card",
  DEPOSIT: "Deposit",
  BANK_TRANSFER: "Bank transfer",
  STORE_CREDIT: "Store credit",
};

const PAYMENT_DETAIL_STATUS_LABEL = {
  PENDING: "Pending",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  VOIDED: "Voided",
};

// Unified status computed server-side (see
// apps/api/src/services/orderStatus.service.js) from Order.status/
// paymentStatus/fulfillmentStatus — the storefront only ever sees the
// online ladder (listOrders scopes to channel: "ONLINE"), so "Draft" never
// appears here.
const DISPLAY_STATUS = {
  Ordered: { label: "Ordered", tone: "neutral" },
  Processing: { label: "Processing", tone: "neutral" },
  Ready: { label: "Ready", tone: "warn" },
  Completed: { label: "Completed", tone: "good" },
  Canceled: { label: "Canceled", tone: "bad" },
};

// 3-step progress reading of the unified status, for the stepper shown in
// the expanded order view. "Ordered"/"Processing" both read as step 1 (the
// order is confirmed and being prepared); "Ready" is step 2 — labeled
// "Shipped" for delivery orders and "Ready for Pickup" for pickup/in-store,
// since fulfillment only ever tracks readiness, not a carrier shipment;
// "Completed" is step 3, labeled by how it was actually fulfilled.
// "Canceled" has no step position — callers should not render the stepper
// for a canceled order.
function stepperStepsFor(order) {
  const isDelivery = order.fulfillmentMethod === "DELIVERY";
  const steps = [
    { key: "confirmed", label: "Order Confirmed" },
    { key: "shipped", label: isDelivery ? "Shipped" : "Ready for Pickup" },
    { key: "delivered", label: isDelivery ? "Delivered" : "Picked Up" },
  ];
  const activeIndex =
    order.displayStatus === "Completed" ? 2 : order.displayStatus === "Ready" ? 1 : 0;
  return { steps, activeIndex };
}

function Badge({ tone, children }) {
  const tones = {
    good: "bg-green-100 text-green-800",
    warn: "bg-brand-gold/25 text-brand-charcoal",
    bad: "bg-brand-red/10 text-brand-red-dark",
    neutral: "bg-brand-charcoal/10 text-brand-charcoal/80",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function formatPlacedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatusStepper({ order }) {
  if (order.displayStatus === "Canceled") {
    return <Badge tone="bad">Canceled</Badge>;
  }
  const { steps, activeIndex } = stepperStepsFor(order);

  return (
    <ol className="flex items-start">
      {steps.map((step, index) => {
        const isDone = index <= activeIndex;
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className={`flex items-center ${isLast ? "flex-none" : "flex-1"}`}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                  isDone ? "bg-green-500 text-white" : "border-2 border-brand-charcoal/20 bg-white"
                }`}
              >
                {isDone ? <CheckCircle2 className="size-4" aria-hidden="true" /> : null}
              </span>
              <span
                className={`max-w-20 text-center text-[11px] leading-tight font-semibold sm:max-w-none sm:text-xs ${
                  isDone ? "text-brand-charcoal" : "text-brand-charcoal/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast ? (
              <span
                aria-hidden="true"
                className={`mx-1.5 h-0.5 flex-1 rounded-full sm:mx-2 ${
                  index < activeIndex ? "bg-green-500" : "bg-brand-charcoal/15"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function OrderDetail({ order }) {
  const hasAddress = order.fulfillmentMethod === "DELIVERY" && order.shippingAddress;

  return (
    <div className="mt-4 space-y-5 border-t border-brand-charcoal/10 pt-4">
      <StatusStepper order={order} />

      {hasAddress ? (
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-charcoal">
            <MapPin className="size-4 text-brand-charcoal/50" aria-hidden="true" />
            Shipping Address
          </p>
          <p className="mt-1 text-sm text-brand-charcoal/70">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-semibold text-brand-charcoal">Items</p>
        <ul className="mt-2 divide-y divide-brand-charcoal/10 text-sm">
          {order.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-2.5">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-brand-cream">
                {line.imageUrl ? (
                  <Image src={line.imageUrl} alt={line.name} fill sizes="48px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-brand-charcoal">{line.name}</p>
                <p className="text-xs text-brand-charcoal/60">
                  {line.quantity} × {money(line.unitPriceCents)}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-brand-charcoal">{money(line.lineTotalCents)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-brand-charcoal/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-brand-charcoal/60">Subtotal</dt>
            <dd>{money(order.subtotalCents)}</dd>
          </div>
          {order.discountCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-brand-charcoal/60">Discount</dt>
              <dd>−{money(order.discountCents)}</dd>
            </div>
          ) : null}
          {order.deliveryFeeCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-brand-charcoal/60">Delivery</dt>
              <dd>{money(order.deliveryFeeCents)}</dd>
            </div>
          ) : null}
          {order.taxCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-brand-charcoal/60">Tax</dt>
              <dd>{money(order.taxCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd>{money(order.totalCents)}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-charcoal">
          <CreditCard className="size-4 text-brand-charcoal/50" aria-hidden="true" />
          Payment
        </p>
        {order.payments.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-sm">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3">
                <span className="text-brand-charcoal/70">
                  {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method} ·{" "}
                  {PAYMENT_DETAIL_STATUS_LABEL[payment.status] ?? payment.status}
                </span>
                <span className="font-semibold text-brand-charcoal">{money(payment.amountCents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-brand-charcoal/60">
            {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
          </p>
        )}
      </div>

      {order.displayStatus === "Completed" ? (
        <button
          type="button"
          onClick={() => downloadInvoice(order)}
          className="inline-flex items-center gap-2 rounded-full border border-brand-charcoal/20 px-4 py-2 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        >
          <FileDown className="size-4" aria-hidden="true" />
          Download Invoice
        </button>
      ) : null}
    </div>
  );
}

// Opens a print-formatted invoice in a new tab — the customer's browser
// "Save as PDF" print option is the actual download; no PDF-generation
// dependency needed for a one-page, print-ready document like this.
function downloadInvoice(order) {
  const html = buildInvoiceHtml(order);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function OrderCard({ order }) {
  const method = FULFILLMENT_METHOD_LABEL[order.fulfillmentMethod];
  const thumbnail = order.lines.find((line) => line.imageUrl)?.imageUrl ?? null;
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-xl border border-brand-charcoal/15 bg-white p-4 transition-all hover:border-brand-charcoal/25 hover:shadow-md sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-red/10 text-brand-red sm:size-11">
            {thumbnail ? (
              <Image src={thumbnail} alt="" fill sizes="44px" className="object-cover" />
            ) : (
              <Package className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-brand-charcoal">Order {order.orderNumber}</p>
            <p className="mt-0.5 text-sm text-brand-charcoal/60">
              Placed {formatPlacedDate(order.placedAt)}
              {method ? ` · ${method}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Badge tone={DISPLAY_STATUS[order.displayStatus]?.tone ?? "neutral"}>
            {DISPLAY_STATUS[order.displayStatus]?.label ?? order.displayStatus}
          </Badge>
          <ChevronDown
            className={`size-5 text-brand-charcoal/40 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {open ? <OrderDetail order={order} /> : null}
    </li>
  );
}

export default function OrdersSection({ onSessionExpired }) {
  const [orders, setOrders] = useState(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listOrders({ page: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setOrders(result.orders);
        setTotal(result.pagination.total);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isSessionExpired(error)) onSessionExpired();
        else setLoadError(describeError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, onSessionExpired]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setMoreError(null);
    try {
      // Page size is fixed, so the next page is however many pages are already
      // shown plus one.
      const nextPage = Math.floor(orders.length / PAGE_SIZE) + 1;
      const result = await listOrders({ page: nextPage, pageSize: PAGE_SIZE });
      setOrders((current) => {
        // A new order placed meanwhile shifts rows down a page; skip any row
        // already on screen rather than showing it twice.
        const seen = new Set(current.map((order) => order.id));
        return [...current, ...result.orders.filter((order) => !seen.has(order.id))];
      });
      setTotal(result.pagination.total);
    } catch (error) {
      if (isSessionExpired(error)) onSessionExpired();
      else setMoreError(describeError(error));
    } finally {
      setLoadingMore(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <Notice notice={{ type: "error", message: loadError }} className="" />
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setReloadKey((key) => key + 1);
          }}
          className={`${linkButtonClass} mt-3`}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!orders) {
    return (
      <p role="status" aria-busy="true" className="text-sm text-brand-charcoal/60">
        Loading&hellip;
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-brand-charcoal/15 bg-brand-cream/30 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
          <Package className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-4 font-display text-lg font-bold text-brand-charcoal">No orders yet</p>
        <p className="mt-1 max-w-sm text-sm text-brand-charcoal/60">
          When you place an order with the email on this account, it will show up here.
        </p>
        <Link
          href="/shop"
          className="mt-5 rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-red-dark hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <ul className="flex flex-col gap-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ul>
      {orders.length < total ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={`w-full sm:w-auto ${secondaryButtonClass}`}
          >
            {loadingMore ? "Loading…" : "Show more orders"}
          </button>
          <Notice notice={moreError ? { type: "error", message: moreError } : null} />
        </div>
      ) : null}
    </div>
  );
}
