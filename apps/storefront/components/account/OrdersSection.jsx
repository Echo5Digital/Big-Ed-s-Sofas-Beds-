"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { listOrders, isSessionExpired } from "@/lib/api/customerAccount";
import { Notice, describeError, linkButtonClass, secondaryButtonClass } from "@/components/account/formParts";
import { formatCurrency } from "@/utils/formatCurrency";

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

const FULFILLMENT_LABEL = {
  UNALLOCATED: "Processing",
  RESERVED: "Processing",
  READY: "Ready",
  PICKED_UP: "Picked up",
  DELIVERED: "Delivered",
};

// Order status, payment status and fulfillment status are separate things in
// the API; the customer sees one label for how the order is progressing and one
// for how it's been paid.
function progressLabel(order) {
  if (order.status === "CANCELED") return "Canceled";
  if (order.status === "CLOSED") return "Completed";
  return FULFILLMENT_LABEL[order.fulfillmentStatus] ?? "Processing";
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

function progressTone(order) {
  if (order.status === "CANCELED") return "bad";
  if (order.status === "CLOSED" || ["DELIVERED", "PICKED_UP"].includes(order.fulfillmentStatus)) return "good";
  return "neutral";
}

function paymentTone(order) {
  if (order.paymentStatus === "PAID") return "good";
  if (order.paymentStatus === "REFUNDED") return "neutral";
  return "warn";
}

function formatPlacedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function OrderCard({ order }) {
  const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const method = FULFILLMENT_METHOD_LABEL[order.fulfillmentMethod];

  return (
    <li className="rounded-xl border border-brand-charcoal/15 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className="font-display text-base font-bold text-brand-charcoal">Order {order.orderNumber}</p>
          <p className="mt-0.5 text-sm text-brand-charcoal/60">
            Placed {formatPlacedDate(order.placedAt)}
            {method ? ` · ${method}` : ""}
          </p>
        </div>
        <p className="text-base font-bold text-brand-charcoal">{money(order.totalCents)}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={progressTone(order)}>{progressLabel(order)}</Badge>
        <Badge tone={paymentTone(order)}>{PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}</Badge>
      </div>

      {order.lines.length > 0 ? (
        <details className="group mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-red hover:text-brand-red-dark focus-visible:outline-2 focus-visible:outline-brand-red">
            <span className="group-open:hidden">
              View {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="hidden group-open:inline">Hide items</span>
          </summary>
          <ul className="mt-3 divide-y divide-brand-charcoal/10 text-sm">
            {order.lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="break-words text-brand-charcoal">{line.name}</p>
                  <p className="text-xs text-brand-charcoal/60">
                    {line.quantity} × {money(line.unitPriceCents)}
                  </p>
                </div>
                <p className="shrink-0 text-brand-charcoal">{money(line.lineTotalCents)}</p>
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
        </details>
      ) : null}
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
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
          <Package className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-4 font-display text-lg font-bold text-brand-charcoal">No orders yet</p>
        <p className="mt-1 max-w-sm text-sm text-brand-charcoal/60">
          When you place an order with the email on this account, it will show up here.
        </p>
        <Link
          href="/shop"
          className="mt-5 rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
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
          <button type="button" onClick={handleLoadMore} disabled={loadingMore} className={secondaryButtonClass}>
            {loadingMore ? "Loading…" : "Show more orders"}
          </button>
          <Notice notice={moreError ? { type: "error", message: moreError } : null} />
        </div>
      ) : null}
    </div>
  );
}
