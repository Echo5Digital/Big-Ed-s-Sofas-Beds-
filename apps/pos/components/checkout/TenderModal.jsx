"use client";

import { useState, useMemo, useEffect } from "react";
import { Banknote, CreditCard, HandCoins, Landmark, Gift, AlertTriangle, Plus, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatCents } from "@/lib/format";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const TENDERS = [
  { key: "CASH", label: "Cash", icon: Banknote },
  { key: "DEPOSIT", label: "Deposit", icon: HandCoins },
  { key: "BANK_TRANSFER", label: "Bank transfer", icon: Landmark },
  { key: "STORE_CREDIT", label: "Store credit", icon: Gift },
  { key: "CARD", label: "Card (terminal)", icon: CreditCard },
];

export default function TenderModal({
  open,
  onClose,
  subtotalCents,
  totalCostCents = 0,
  customer,
  onConfirm,
  submitting,
  error,
}) {
  const [entries, setEntries] = useState([]);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReasonCode, setDiscountReasonCode] = useState("");
  const [storeCreditBalanceCents, setStoreCreditBalanceCents] = useState(null);

  // Reset the form the moment `open` flips to false — covers both an
  // explicit cancel (handleClose below) and the parent closing this modal
  // itself after a successful confirm — without needing a key-remount
  // (which raced against the in-flight onConfirm promise's own state
  // updates) or an Effect. This is React's documented "adjust state during
  // render" pattern for resetting on a prop change.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setEntries([]);
      setAmount("");
      setReference("");
      setDiscountAmount("");
      setDiscountReasonCode("");
      setMethod("CASH");
    }
  }

  function handleClose() {
    onClose();
  }

  useEffect(() => {
    if (!open || !customer?.id) return;
    let cancelled = false;
    api
      .get(`/pos/customers/${customer.id}/store-credit`)
      .then((data) => {
        if (!cancelled) setStoreCreditBalanceCents(data.balanceCents);
      })
      .catch(() => {
        if (!cancelled) setStoreCreditBalanceCents(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customer?.id]);

  const discountCents = Math.round(Number(discountAmount || 0) * 100);
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const belowCost = totalCostCents > 0 && totalCents < totalCostCents;

  const amountAddedCents = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const remainingBalanceCents = Math.max(0, totalCents - amountAddedCents);
  const entryAmountCents = Math.round(Number(amount || 0) * 100);

  const canAddEntry = useMemo(() => {
    if (!entryAmountCents || entryAmountCents <= 0) return false;
    if (method === "CARD") return false;
    if (method === "STORE_CREDIT") {
      if (!customer?.id) return false;
      if (storeCreditBalanceCents == null || entryAmountCents > storeCreditBalanceCents) return false;
    }
    // Only cash may exceed the remaining balance (to produce change).
    if (method !== "CASH" && entryAmountCents > remainingBalanceCents) return false;
    return true;
  }, [entryAmountCents, method, customer?.id, storeCreditBalanceCents, remainingBalanceCents]);

  function handleAddEntry() {
    if (!canAddEntry) return;
    setEntries((prev) => [...prev, { method, amountCents: entryAmountCents, reference: reference.trim() || undefined }]);
    setAmount("");
    setReference("");
  }

  function handleRemoveEntry(index) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  const totalTenderedCents = amountAddedCents;
  const cashTenderedCents = entries.filter((e) => e.method === "CASH").reduce((sum, e) => sum + e.amountCents, 0);
  const changeDueCents = Math.max(0, totalTenderedCents - totalCents);
  const hasDeposit = entries.some((e) => e.method === "DEPOSIT");

  const canConfirm = useMemo(() => {
    if (entries.length === 0) return false;
    if (discountCents > subtotalCents) return false;
    if (discountCents > 0 && !discountReasonCode.trim()) return false;
    if (belowCost) return false;
    return totalTenderedCents >= totalCents || hasDeposit;
  }, [entries.length, discountCents, subtotalCents, discountReasonCode, belowCost, totalTenderedCents, totalCents, hasDeposit]);

  function handleConfirm() {
    onConfirm({
      payments: entries,
      discountCents: discountCents > 0 ? discountCents : undefined,
      discountReasonCode: discountCents > 0 ? discountReasonCode.trim() : undefined,
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Take payment">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="discountAmount" className="text-sm font-medium text-brand-charcoal">
            Discount ($, optional)
          </label>
          <input
            id="discountAmount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
          />
          {discountCents > 0 && (
            <input
              type="text"
              placeholder="Reason for discount (required)"
              value={discountReasonCode}
              onChange={(e) => setDiscountReasonCode(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          )}
        </div>

        {belowCost && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            This sale&apos;s total ({formatCents(totalCents)}) is below what we paid for these items (
            {formatCents(totalCostCents)}). Reduce the discount to continue.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TENDERS.map(({ key, label, icon: Icon }) => {
            const disabled = key === "CARD" || (key === "STORE_CREDIT" && !customer?.id);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[11px] font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                  method === key
                    ? "border-brand-red bg-brand-red/5 text-brand-red shadow-sm ring-1 ring-brand-red/10"
                    : "border-black/10 text-brand-charcoal/70 hover:border-black/20 hover:bg-brand-cream/50"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        {method === "CARD" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            Card-present payment isn&apos;t available yet — the store hasn&apos;t selected a payment processor or
            terminal model. Use another tender for now.
          </p>
        )}

        {method === "STORE_CREDIT" && (
          <p className="rounded-lg bg-brand-cream/70 px-3 py-2.5 text-sm text-brand-charcoal/70">
            {customer?.id
              ? storeCreditBalanceCents == null
                ? "Loading balance…"
                : `${customer.firstName}'s store credit balance: ${formatCents(storeCreditBalanceCents)}`
              : "Attach a customer to this sale to redeem store credit."}
          </p>
        )}

        {method !== "CARD" && (
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="entryAmount" className="text-sm font-medium text-brand-charcoal">
                Amount ($)
              </label>
              <input
                id="entryAmount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
              />
            </div>
            {(method === "BANK_TRANSFER" || method === "STORE_CREDIT") && (
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="entryReference" className="text-sm font-medium text-brand-charcoal">
                  Reference (optional)
                </label>
                <input
                  id="entryReference"
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                />
              </div>
            )}
            <Button type="button" variant="outline" icon={Plus} disabled={!canAddEntry} onClick={handleAddEntry}>
              Add
            </Button>
          </div>
        )}

        {entries.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-lg border border-black/10 p-2">
            {entries.map((entry, index) => (
              <li key={index} className="flex items-center justify-between gap-2 rounded-md bg-brand-cream/40 px-2.5 py-2 text-sm">
                <span className="font-medium text-brand-charcoal">
                  {TENDERS.find((t) => t.key === entry.method)?.label ?? entry.method}
                  {entry.reference ? ` · ${entry.reference}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(entry.amountCents)}</span>
                  <button
                    type="button"
                    aria-label="Remove payment entry"
                    onClick={() => handleRemoveEntry(index)}
                    className="flex size-6 items-center justify-center rounded-full text-brand-charcoal/40 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1.5 rounded-lg bg-brand-cream/70 px-3 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-charcoal/70">Order total</span>
            <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(totalCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-brand-charcoal/70">Amount added</span>
            <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(amountAddedCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-brand-charcoal/70">Remaining balance</span>
            <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(remainingBalanceCents)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-black/10 pt-1.5">
            <span className="font-medium text-brand-charcoal/70">Total tendered</span>
            <span className="font-display text-base font-bold tabular-nums text-brand-charcoal">
              {formatCents(totalTenderedCents)}
            </span>
          </div>
        </div>

        {cashTenderedCents > 0 && changeDueCents > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-3 text-sm">
            <span className="font-medium text-green-800">Change due</span>
            <span className="font-display text-base font-bold tabular-nums text-green-800">
              {formatCents(changeDueCents)}
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button size="lg" disabled={!canConfirm || submitting} onClick={handleConfirm} className="w-full">
          {submitting ? "Processing…" : "Confirm payment"}
        </Button>
      </div>
    </Modal>
  );
}
