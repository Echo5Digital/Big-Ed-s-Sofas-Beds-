"use client";

import { useState, useMemo } from "react";
import { Banknote, CreditCard, HandCoins } from "lucide-react";
import { formatCents } from "@/lib/format";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const TENDERS = [
  { key: "CASH", label: "Cash", icon: Banknote },
  { key: "CARD", label: "Card (terminal)", icon: CreditCard },
  { key: "DEPOSIT", label: "Deposit", icon: HandCoins },
];

export default function TenderModal({ open, onClose, subtotalCents, onConfirm, submitting, error }) {
  const [tenderMethod, setTenderMethod] = useState("CASH");
  const [tendered, setTendered] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  const tenderedCents = Math.round(Number(tendered || 0) * 100);
  const depositAmountCents = Math.round(Number(depositAmount || 0) * 100);
  const amountDueCents = tenderMethod === "DEPOSIT" ? depositAmountCents : subtotalCents;
  const changeDueCents = tenderMethod === "CASH" ? Math.max(0, tenderedCents - amountDueCents) : 0;

  const canConfirm = useMemo(() => {
    if (tenderMethod === "CARD") return false;
    if (tenderMethod === "DEPOSIT" && (!depositAmountCents || depositAmountCents > subtotalCents)) return false;
    return tenderedCents >= amountDueCents;
  }, [tenderMethod, tenderedCents, amountDueCents, depositAmountCents, subtotalCents]);

  function handleConfirm() {
    onConfirm({
      tenderMethod,
      tenderedCents,
      depositAmountCents: tenderMethod === "DEPOSIT" ? depositAmountCents : undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Take payment">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {TENDERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTenderMethod(key)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-colors ${
                tenderMethod === key
                  ? "border-brand-red bg-brand-red/5 text-brand-red"
                  : "border-black/10 text-brand-charcoal/70 hover:bg-gray-50"
              }`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {tenderMethod === "CARD" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            Card-present payment isn&apos;t available yet — the store hasn&apos;t selected a payment processor or
            terminal model. Use cash or deposit for now.
          </p>
        )}

        {tenderMethod === "DEPOSIT" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="depositAmount" className="text-sm font-medium text-brand-charcoal">
              Deposit amount ($)
            </label>
            <input
              id="depositAmount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-3 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
            <p className="text-xs text-brand-charcoal/50">Order total: {formatCents(subtotalCents)}</p>
          </div>
        )}

        {tenderMethod !== "CARD" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tendered" className="text-sm font-medium text-brand-charcoal">
              Amount tendered ($)
            </label>
            <input
              id="tendered"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-3 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
          <span className="text-brand-charcoal/70">Amount due</span>
          <span className="font-semibold text-brand-charcoal">{formatCents(amountDueCents)}</span>
        </div>

        {tenderMethod === "CASH" && tenderedCents > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2.5 text-sm">
            <span className="text-green-800">Change due</span>
            <span className="font-semibold text-green-800">{formatCents(changeDueCents)}</span>
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
