"use client";

import { useState } from "react";
import { Banknote, CreditCard, HandCoins, AlertTriangle, Plus, X } from "lucide-react";
import { formatCents } from "@/lib/format";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

// Only these three tenders are offered — Bank Transfer and Store Credit are
// deliberately not in this list (a prior iteration had them; both worked,
// but the business only wants Cash/Card/Deposit at the register). Card is a
// Square Terminal checkout (apps/api/src/services/pos.service.js's
// createCardCheckout) — single-tender only (see canAddEntry below) and
// resolves asynchronously, unlike Cash/Deposit which confirm this same
// request. If the register has no paired terminal (Register.squareDeviceId
// unset), the API rejects with a clear message rather than this UI guessing
// at availability client-side.
const TENDERS = [
  { key: "CASH", label: "Cash", icon: Banknote },
  { key: "CARD", label: "Card (terminal)", icon: CreditCard },
  { key: "DEPOSIT", label: "Deposit", icon: HandCoins },
];

// Discounts above this percent of subtotal need a manager/admin PIN —
// mirrors CASHIER_DISCOUNT_CEILING_PERCENT in apps/api/src/services/pos.service.js.
// This is a client-side UX mirror only; the server always re-derives and
// re-checks this independently and is the real guardrail.
const CASHIER_DISCOUNT_CEILING_PERCENT = 10;

export default function TenderModal({
  open,
  onClose,
  subtotalCents,
  cart = [],
  totalCostCents = 0,
  onConfirm,
  submitting,
  error,
}) {
  const [entries, setEntries] = useState([]);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [discountMode, setDiscountMode] = useState("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReasonCode, setDiscountReasonCode] = useState("");
  const [approverPin, setApproverPin] = useState("");

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
      setDiscountMode("PERCENT");
      setDiscountValue("");
      setDiscountReasonCode("");
      setApproverPin("");
      setMethod("CASH");
    }
  }

  function handleClose() {
    onClose();
  }

  const discountCents =
    discountMode === "PERCENT"
      ? Math.round((subtotalCents * Number(discountValue || 0)) / 100)
      : Math.round(Number(discountValue || 0) * 100);

  // Preview mirror of the server's per-line tax calc in pos.service.js: each
  // line absorbs a share of the discount proportional to its own subtotal
  // share, then tax applies to what's left of that line. The server is the
  // real source of truth (recomputed fresh from the DB on submit) — this is
  // only so the cashier sees, and collects, the same total before
  // confirming the sale. Carries the running discount allocation inside the
  // reduce's own accumulator (rather than a `let` closed over outside it) so
  // the last line can still absorb the rounding remainder without mutating
  // state across renders.
  const taxCents = cart.reduce(
    (acc, line, i) => {
      const lineSubtotalCents = line.priceCents * line.quantity;
      const isLastLine = i === cart.length - 1;
      const lineDiscountCents = isLastLine
        ? discountCents - acc.allocatedDiscountCents
        : subtotalCents > 0
          ? Math.round((discountCents * lineSubtotalCents) / subtotalCents)
          : 0;
      const taxableCents = lineSubtotalCents - lineDiscountCents;
      const lineTaxCents = Math.round((taxableCents * Number(line.taxRatePercent ?? 0)) / 100);
      return {
        allocatedDiscountCents: acc.allocatedDiscountCents + lineDiscountCents,
        taxCents: acc.taxCents + lineTaxCents,
      };
    },
    { allocatedDiscountCents: 0, taxCents: 0 }
  ).taxCents;

  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
  const belowCost = totalCostCents > 0 && totalCents < totalCostCents;
  const effectiveDiscountPercent = subtotalCents > 0 ? (discountCents / subtotalCents) * 100 : 0;
  const pinRequired = discountCents > 0 && effectiveDiscountPercent > CASHIER_DISCOUNT_CEILING_PERCENT;

  const amountAddedCents = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const remainingBalanceCents = Math.max(0, totalCents - amountAddedCents);
  const entryAmountCents = Math.round(Number(amount || 0) * 100);

  // Plain derived values, not useMemo — this form is small enough that
  // memoizing bought nothing but a dependency-array footgun (easy to list a
  // proxy like entries.length instead of the actual values a check reads,
  // and silently recompute on the wrong renders).
  const canAddEntry = (() => {
    if (!entryAmountCents || entryAmountCents <= 0) return false;
    if (method === "CARD") return false;
    // Only cash may exceed the remaining balance (to produce change).
    if (method !== "CASH" && entryAmountCents > remainingBalanceCents) return false;
    return true;
  })();

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
  const changeDueCents = Math.max(0, totalTenderedCents - totalCents);
  const hasDeposit = entries.some((e) => e.method === "DEPOSIT");

  const canConfirm = (() => {
    if (discountCents > subtotalCents) return false;
    if (discountCents > 0 && !discountReasonCode.trim()) return false;
    if (pinRequired && !/^\d{4,6}$/.test(approverPin)) return false;
    if (belowCost) return false;
    // Card never uses the entries list (see canAddEntry) — it's confirmable
    // on its own once the total is a real, chargeable amount.
    if (method === "CARD") return totalCents > 0;
    if (entries.length === 0) return false;
    return totalTenderedCents >= totalCents || hasDeposit;
  })();

  function handleConfirm() {
    const discountValueNumber = Number(discountValue || 0);
    onConfirm({
      payments: method === "CARD" ? [{ method: "CARD", amountCents: totalCents }] : entries,
      discount:
        discountCents > 0
          ? discountMode === "PERCENT"
            ? { mode: "PERCENT", percent: discountValueNumber }
            : { mode: "FLAT_CENTS", amountCents: discountCents }
          : undefined,
      discountReasonCode: discountCents > 0 ? discountReasonCode.trim() : undefined,
      pinOverride: pinRequired ? { approverPin } : undefined,
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Take payment">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="discountValue" className="text-sm font-medium text-brand-charcoal">
            Discount (optional)
          </label>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-black/15 p-0.5">
              {[
                { key: "PERCENT", label: "%" },
                { key: "FLAT_CENTS", label: "$" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDiscountMode(key)}
                  className={`w-9 rounded-md py-2.5 text-sm font-semibold transition-colors ${
                    discountMode === key ? "bg-brand-red text-white" : "text-brand-charcoal/60 hover:bg-black/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              id="discountValue"
              type="number"
              min="0"
              step={discountMode === "PERCENT" ? "1" : "0.01"}
              max={discountMode === "PERCENT" ? "100" : undefined}
              inputMode="decimal"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="flex-1 rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </div>
          {discountCents > 0 && (
            <input
              type="text"
              placeholder="Reason for discount (required)"
              value={discountReasonCode}
              onChange={(e) => setDiscountReasonCode(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          )}
          {pinRequired && (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                Discounts over {CASHIER_DISCOUNT_CEILING_PERCENT}% need a manager or admin&apos;s PIN to approve.
              </p>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Manager PIN"
                value={approverPin}
                onChange={(e) => setApproverPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="rounded-lg border border-black/15 px-3 py-3 text-base tracking-widest transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
              />
            </>
          )}
        </div>

        {belowCost && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            This sale&apos;s total ({formatCents(totalCents)}) is below what we paid for these items (
            {formatCents(totalCostCents)}). Reduce the discount to continue.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {TENDERS.map(({ key, label, icon: Icon }) => {
            // Card is single-tender only — switching to it with other
            // entries already added would be ambiguous (charge the card for
            // the full total, or just the remaining balance?), so it's
            // disabled once any entry exists; clear entries first to use it.
            const disabled = key === "CARD" && entries.length > 0;
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
          <p className="rounded-lg bg-brand-cream px-3 py-2.5 text-sm text-brand-charcoal/70">
            The customer will tap, insert, or swipe their card on the register&apos;s terminal for the full order
            total ({formatCents(totalCents)}).
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
            <span className="text-brand-charcoal/70">Subtotal</span>
            <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(subtotalCents)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-brand-charcoal/70">Discount</span>
              <span className="font-semibold tabular-nums text-brand-charcoal">-{formatCents(discountCents)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-brand-charcoal/70">Tax</span>
            <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(taxCents)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-black/10 pt-1.5">
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
          {submitting ? "Processing…" : method === "CARD" ? "Send to terminal" : "Confirm payment"}
        </Button>
      </div>
    </Modal>
  );
}
