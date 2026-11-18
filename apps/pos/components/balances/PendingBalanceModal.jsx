"use client";

import { useMemo, useState } from "react";
import { Search, Banknote, HandCoins } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCents } from "@/lib/format";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import ReceiptView from "../checkout/ReceiptView";

// Only these two — Card isn't available yet (same reason it's disabled at
// checkout: no payment processor/terminal selected), and Pending Balance
// never needed the full checkout tender set in the first place.
const TENDERS = [
  { key: "CASH", label: "Cash", icon: Banknote },
  { key: "DEPOSIT", label: "Deposit", icon: HandCoins },
];

function FindOrderStep({ onFound }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.get(`/pos/balances/find-order?q=${encodeURIComponent(query.trim())}`);
      onFound(data.order);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to find a matching order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex flex-col gap-3">
      <p className="text-sm text-brand-charcoal/60">
        Search by order number, receipt number, or customer phone number for a sale that still has a balance owed.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal/40" aria-hidden="true" />
        <input
          autoFocus
          type="text"
          placeholder="Order #, receipt #, or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-black/15 py-3 pl-10 pr-3 text-base focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading || !query.trim()}>
        {loading ? "Searching…" : "Find order"}
      </Button>
    </form>
  );
}

function OrderSummary({ order }) {
  return (
    <div className="rounded-lg bg-brand-cream/60 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-brand-charcoal">Order {order.orderNumber}</span>
        <Badge tone="warning">{order.paymentStatus === "PARTIALLY_PAID" ? "Partially paid" : "Unpaid"}</Badge>
      </div>
      <p className="mt-0.5 text-xs text-brand-charcoal/50">
        {new Date(order.createdAt).toLocaleString()}
        {order.customer && ` · ${order.customer.firstName} ${order.customer.lastName}`}
      </p>
      <ul className="mt-2 flex flex-col gap-1 border-t border-black/10 pt-2 text-xs text-brand-charcoal/70">
        {order.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-2">
            <span className="truncate">
              {line.quantity}× {line.name}
            </span>
            <span>{formatCents(line.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettleStep({ order, onConfirm, submitting, error }) {
  const [entries, setEntries] = useState([]);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("");

  const amountAddedCents = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const remainingCents = Math.max(0, order.balanceDueCents - amountAddedCents);
  const entryAmountCents = Math.round(Number(amount || 0) * 100);

  const canAddEntry = useMemo(() => {
    if (!entryAmountCents || entryAmountCents <= 0) return false;
    // Only cash may exceed the remaining balance (to produce change) — same
    // rule as the main checkout TenderModal.
    if (method !== "CASH" && entryAmountCents > remainingCents) return false;
    return true;
  }, [entryAmountCents, method, remainingCents]);

  function handleAddEntry() {
    if (!canAddEntry) return;
    setEntries((prev) => [...prev, { method, amountCents: entryAmountCents }]);
    setAmount("");
  }

  function handleRemoveEntry(index) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  const totalTenderedCents = amountAddedCents;
  const cashTenderedCents = entries.filter((e) => e.method === "CASH").reduce((sum, e) => sum + e.amountCents, 0);
  const changeDueCents = Math.max(0, totalTenderedCents - order.balanceDueCents);
  const hasDeposit = entries.some((e) => e.method === "DEPOSIT");
  // A further-reduced deposit (deposit-on-a-deposit) is allowed, same as the
  // original sale; a plain cash/card-style payoff still needs to cover the
  // full remaining balance.
  const canConfirm = entries.length > 0 && (totalTenderedCents >= order.balanceDueCents || hasDeposit);

  return (
    <div className="flex flex-col gap-4">
      <OrderSummary order={order} />

      <div className="flex flex-col gap-1.5 rounded-lg bg-brand-cream/70 px-3 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-brand-charcoal/70">Subtotal</span>
          <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(order.subtotalCents)}</span>
        </div>
        {order.discountCents > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-brand-charcoal/70">Discount</span>
            <span className="font-semibold tabular-nums text-brand-charcoal">-{formatCents(order.discountCents)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-brand-charcoal/70">Tax</span>
          <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(order.taxCents)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-black/10 pt-1.5">
          <span className="text-brand-charcoal/70">Order total</span>
          <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(order.totalCents)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-brand-charcoal/70">Already paid</span>
          <span className="font-semibold tabular-nums text-brand-charcoal">-{formatCents(order.paidSoFarCents)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-black/10 pt-1.5">
          <span className="font-medium text-brand-charcoal/70">Balance due</span>
          <span className="font-display text-base font-bold tabular-nums text-brand-red">
            {formatCents(order.balanceDueCents)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TENDERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMethod(key)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[11px] font-semibold transition-all duration-150 ${
              method === key
                ? "border-brand-red bg-brand-red/5 text-brand-red shadow-sm ring-1 ring-brand-red/10"
                : "border-black/10 text-brand-charcoal/70 hover:border-black/20 hover:bg-brand-cream/50"
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="settleAmount" className="text-sm font-medium text-brand-charcoal">
            Amount ($)
          </label>
          <input
            id="settleAmount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
          />
        </div>
        <Button type="button" variant="outline" disabled={!canAddEntry} onClick={handleAddEntry}>
          Add
        </Button>
      </div>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-lg border border-black/10 p-2">
          {entries.map((entry, index) => (
            <li key={index} className="flex items-center justify-between gap-2 rounded-md bg-brand-cream/40 px-2.5 py-2 text-sm">
              <span className="font-medium text-brand-charcoal">{TENDERS.find((t) => t.key === entry.method)?.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(entry.amountCents)}</span>
                <button
                  type="button"
                  aria-label="Remove payment entry"
                  onClick={() => handleRemoveEntry(index)}
                  className="text-xs font-semibold text-brand-charcoal/40 hover:text-red-600"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {cashTenderedCents > 0 && changeDueCents > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-3 text-sm">
          <span className="font-medium text-green-800">Change due</span>
          <span className="font-display text-base font-bold tabular-nums text-green-800">{formatCents(changeDueCents)}</span>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button size="lg" disabled={!canConfirm || submitting} onClick={() => onConfirm(entries)} className="w-full">
        {submitting ? "Processing…" : "Collect payment"}
      </Button>
    </div>
  );
}

export default function PendingBalanceModal({ open, onClose }) {
  const { session } = useRegisterSession();
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completedSale, setCompletedSale] = useState(null);

  function reset() {
    setOrder(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm(entries) {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post("/pos/balances/settle", {
        registerSessionId: session.id,
        orderId: order.id,
        payments: entries,
      });
      setCompletedSale(data);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to collect this payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={handleClose} title="Pending Balance">
        {!order ? <FindOrderStep onFound={setOrder} /> : <SettleStep order={order} onConfirm={handleConfirm} submitting={submitting} error={error} />}
      </Modal>

      <ReceiptView open={Boolean(completedSale)} onClose={() => setCompletedSale(null)} sale={completedSale} />
    </>
  );
}
