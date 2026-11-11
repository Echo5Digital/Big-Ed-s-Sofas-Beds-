"use client";

import { useState, useMemo } from "react";
import { formatCents } from "@/lib/format";
import Button from "../ui/Button";

const REFUND_METHODS = [
  { key: "CASH", label: "Cash refund" },
  { key: "STORE_CREDIT", label: "Store credit" },
];

const BALANCE_TENDERS = ["CASH", "DEPOSIT", "BANK_TRANSFER", "STORE_CREDIT"];

// Shown when the return has no exchange (straight refund) or the exchange's
// replacement total is lower than the eligible refund (money owed back to
// the customer) — refund method choice, no additional payment collection.
function RefundOnlyPanel({ amountCents, customer, onConfirm, submitting, error }) {
  const [refundMethod, setRefundMethod] = useState("CASH");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-brand-cream/70 px-3 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-brand-charcoal/70">Refund due</span>
          <span className="font-display text-lg font-bold tabular-nums text-brand-red">{formatCents(amountCents)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {REFUND_METHODS.map((m) => {
          const disabled = m.key === "STORE_CREDIT" && !customer?.id;
          return (
            <button
              key={m.key}
              type="button"
              disabled={disabled}
              onClick={() => setRefundMethod(m.key)}
              className={`rounded-xl border p-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                refundMethod === m.key
                  ? "border-brand-red bg-brand-red/5 text-brand-red"
                  : "border-black/10 text-brand-charcoal/70 hover:border-black/20"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {refundMethod === "STORE_CREDIT" && !customer?.id && (
        <p className="text-xs text-brand-charcoal/50">A customer must be attached to this order to issue store credit.</p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        disabled={submitting || (amountCents > 0 && refundMethod === "STORE_CREDIT" && !customer?.id)}
        onClick={() => onConfirm({ refundMethod: amountCents > 0 ? refundMethod : undefined })}
      >
        {submitting ? "Processing…" : "Complete return"}
      </Button>
    </div>
  );
}

// Shown when the exchange's replacement total is higher than the eligible
// refund — the cashier must collect the balance due via one or more
// payment entries (same tenders as a regular sale).
function BalanceDuePanel({ diffCents, customer, onConfirm, submitting, error }) {
  const [entries, setEntries] = useState([]);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("");

  const addedCents = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const remainingCents = Math.max(0, diffCents - addedCents);
  const entryAmountCents = Math.round(Number(amount || 0) * 100);

  const canAdd = useMemo(() => {
    if (!entryAmountCents || entryAmountCents <= 0) return false;
    if (method === "STORE_CREDIT" && !customer?.id) return false;
    if (method !== "CASH" && entryAmountCents > remainingCents) return false;
    return true;
  }, [entryAmountCents, method, customer?.id, remainingCents]);

  function handleAdd() {
    if (!canAdd) return;
    setEntries((prev) => [...prev, { method, amountCents: entryAmountCents }]);
    setAmount("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-brand-cream/70 px-3 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-brand-charcoal/70">Balance due</span>
          <span className="font-display text-lg font-bold tabular-nums text-brand-red">{formatCents(diffCents)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-brand-charcoal/50">
          <span>Remaining</span>
          <span className="font-semibold">{formatCents(remainingCents)}</span>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-black/15 px-3 py-3 text-sm">
          {BALANCE_TENDERS.map((t) => (
            <option key={t} value={t} disabled={t === "STORE_CREDIT" && !customer?.id}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-lg border border-black/15 px-3 py-3 text-base"
        />
        <Button type="button" variant="outline" disabled={!canAdd} onClick={handleAdd}>
          Add
        </Button>
      </div>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {entries.map((e, i) => (
            <li key={i} className="flex justify-between rounded-md bg-brand-cream/40 px-2.5 py-2 text-sm">
              <span>{e.method}</span>
              <span className="font-semibold tabular-nums">{formatCents(e.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button disabled={submitting || addedCents < diffCents} onClick={() => onConfirm({ balancePayments: entries })}>
        {submitting ? "Processing…" : "Complete exchange"}
      </Button>
    </div>
  );
}

export default function ReturnPaymentModal({
  eligibleRefundCents,
  replacementTotalCents,
  diffCents,
  hasExchange,
  customer,
  onConfirm,
  submitting,
  error,
}) {
  if (hasExchange) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 rounded-lg bg-brand-cream/70 px-3 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-charcoal/70">Eligible refund</span>
            <span className="font-semibold tabular-nums">{formatCents(eligibleRefundCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-charcoal/70">Replacement total</span>
            <span className="font-semibold tabular-nums">{formatCents(replacementTotalCents)}</span>
          </div>
        </div>

        {diffCents > 0 ? (
          <BalanceDuePanel diffCents={diffCents} customer={customer} onConfirm={onConfirm} submitting={submitting} error={error} />
        ) : diffCents < 0 ? (
          <RefundOnlyPanel amountCents={-diffCents} customer={customer} onConfirm={onConfirm} submitting={submitting} error={error} />
        ) : (
          <>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button disabled={submitting} onClick={() => onConfirm({})}>
              {submitting ? "Processing…" : "Complete exchange (no balance due)"}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <RefundOnlyPanel amountCents={eligibleRefundCents} customer={customer} onConfirm={onConfirm} submitting={submitting} error={error} />
  );
}
