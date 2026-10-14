"use client";

import { useState } from "react";
import { DoorClosed } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import { formatCents } from "@/lib/format";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function CloseRegister({ open, onClose }) {
  const { session, closeSession } = useRegisterSession();
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const closingCashCents = Math.round(Number(closingCash || 0) * 100);
      const data = await api.post(`/pos/sessions/${session.id}/close`, { closingCashCents, notes: notes || null });
      setResult(data.session);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to close register");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    setResult(null);
    setClosingCash("");
    setNotes("");
    closeSession();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={result ? "Register closed" : "Close out register"}>
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <DoorClosed className="size-10 text-brand-charcoal/60" aria-hidden="true" />
            <p className="font-display text-lg font-bold text-brand-charcoal">
              {result.discrepancyCents === 0 ? "Drawer balanced" : "Discrepancy recorded"}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 rounded-xl bg-gray-50 p-4 text-sm">
            <dt className="text-brand-charcoal/60">Opening cash</dt>
            <dd className="text-right font-semibold">{formatCents(result.openingCashCents)}</dd>
            <dt className="text-brand-charcoal/60">Expected cash</dt>
            <dd className="text-right font-semibold">{formatCents(result.expectedCashCents)}</dd>
            <dt className="text-brand-charcoal/60">Counted cash</dt>
            <dd className="text-right font-semibold">{formatCents(result.closingCashCents)}</dd>
            <dt className="text-brand-charcoal/60">Discrepancy</dt>
            <dd className={`text-right font-semibold ${result.discrepancyCents !== 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCents(result.discrepancyCents)}
            </dd>
          </dl>
          <Button onClick={handleDone} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-brand-charcoal/60">
            Count the cash drawer and enter the total. We&apos;ll compare it against recorded cash sales, deposits, and
            refunds for this session.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="closingCash" className="text-sm font-medium text-brand-charcoal">
              Counted cash ($)
            </label>
            <input
              id="closingCash"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-3 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-brand-charcoal">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Closing…" : "Close register"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
