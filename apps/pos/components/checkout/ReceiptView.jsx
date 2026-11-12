"use client";

import { createPortal } from "react-dom";
import { CheckCircle2, Printer } from "lucide-react";
import { formatCents } from "@/lib/format";
import { storeInfo } from "@/lib/storeInfo";
import { useAuth } from "@/lib/hooks/useAuth";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

// Renders into its own top-level node (a sibling of the app root, not nested
// inside the "Sale complete" modal) so the print.css rule in globals.css can
// hide literally everything else in the document and print only this —
// otherwise window.print() captures the whole page behind the modal too.
const TENDER_LABELS = {
  CASH: "Cash",
  CARD: "Card",
  DEPOSIT: "Deposit",
  BANK_TRANSFER: "Bank transfer",
  STORE_CREDIT: "Store credit",
};

function ReceiptPrintable({ sale, cashierName, cashierEmployeeId }) {
  if (typeof document === "undefined") return null;
  const { order, payments, receipt, changeDueCents } = sale;
  const totalPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const isDepositOnly = payments.length === 1 && payments[0].method === "DEPOSIT";
  const printedAt = new Date();

  return createPortal(
    <div id="receipt-print-root" className="hidden">
      <div className="mx-auto w-[80mm] text-black">
        <div className="pb-3 text-center">
          <p className="font-display text-lg font-bold tracking-wide uppercase">{storeInfo.name}</p>
          <p className="mt-1 text-[10px] tracking-wide text-black/70">{storeInfo.address}</p>
          <p className="text-[10px] tracking-wide text-black/70">{storeInfo.phone}</p>
        </div>

        <div className="border-t-2 border-black" />

        <div className="flex items-baseline justify-between py-2 font-mono text-[10px] text-black/70">
          <span>
            Receipt <span className="font-semibold text-black">{receipt.receiptNumber}</span>
          </span>
          <span>{printedAt.toLocaleString()}</span>
        </div>
        <div className="pb-1 font-mono text-[10px] text-black/70">
          Order <span className="font-semibold text-black">{order.orderNumber}</span>
        </div>
        <div className="pb-2 font-mono text-[10px] text-black/70">
          Cashier: {cashierName}
          {cashierEmployeeId ? ` (${cashierEmployeeId})` : ""}
        </div>

        <div className="border-t border-dashed border-black/50" />

        <div className="flex flex-col gap-2 py-3 font-mono text-[11px]">
          {order.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-3">
              <span className="leading-snug">
                <span className="font-semibold">{line.quantity}×</span> {line.name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatCents(line.lineTotalCents)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-black/50" />

        <div className="flex flex-col gap-1.5 py-3 font-mono text-[11px]">
          <div className="flex justify-between text-black/70">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCents(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-black/70">
              <span>Discount</span>
              <span className="tabular-nums">-{formatCents(order.discountCents)}</span>
            </div>
          )}
          {changeDueCents > 0 && (
            <div className="flex justify-between text-black/70">
              <span>Change due</span>
              <span className="tabular-nums">{formatCents(changeDueCents)}</span>
            </div>
          )}
        </div>

        <div className="border-t-2 border-black" />

        <div className="flex flex-col gap-1 py-2.5 font-mono text-[11px]">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-black/70">
              <span>{TENDER_LABELS[p.method] ?? p.method}</span>
              <span className="tabular-nums">{formatCents(p.amountCents)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between py-2.5">
          <span className="font-display text-sm font-bold uppercase tracking-wide">
            {isDepositOnly ? "Deposit Paid" : "Total Paid"}
          </span>
          <span className="font-mono text-base font-bold tabular-nums">{formatCents(totalPaidCents)}</span>
        </div>

        <div className="border-t-2 border-black" />

        <div className="pt-4 pb-1 text-center">
          <p className="font-display text-sm font-semibold">Thank You For Shopping With Us</p>
          <p className="mt-0.5 text-[10px] tracking-[0.2em] text-black/60 uppercase">Visit Again</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ReceiptView({ open, onClose, sale }) {
  const { user } = useAuth();
  const cashierName = user ? `${user.firstName} ${user.lastName}` : "—";
  const cashierEmployeeId = user?.employeeId ?? null;

  if (!sale) return null;
  const { order, payments, receipt, changeDueCents } = sale;
  const totalPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const isDepositOnly = payments.length === 1 && payments[0].method === "DEPOSIT";

  return (
    <>
      <Modal open={open} onClose={onClose} title="Sale complete">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="size-8 text-green-600" aria-hidden="true" />
            </span>
            <p className="font-display text-xl font-bold tabular-nums text-brand-charcoal">
              {formatCents(totalPaidCents)} {isDepositOnly ? "deposit" : "paid"}
            </p>
            <p className="text-sm text-brand-charcoal/50">
              Receipt {receipt.receiptNumber} · Order {order.orderNumber}
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-black/15 bg-brand-cream/30 p-4 font-mono text-xs text-brand-charcoal">
            <ul className="flex flex-col gap-1">
              {order.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {line.quantity}× {line.name}
                  </span>
                  <span>{formatCents(line.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-dashed border-black/15 pt-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCents(order.subtotalCents)}</span>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{formatCents(order.discountCents)}</span>
                </div>
              )}
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{TENDER_LABELS[p.method] ?? p.method}</span>
                  <span>{formatCents(p.amountCents)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold">
                <span>{isDepositOnly ? "Deposit paid" : "Total paid"}</span>
                <span>{formatCents(totalPaidCents)}</span>
              </div>
              {changeDueCents > 0 && (
                <div className="flex justify-between">
                  <span>Change due</span>
                  <span>{formatCents(changeDueCents)}</span>
                </div>
              )}
            </div>
          </div>

          {order.totalCents > totalPaidCents && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              Remaining balance: {formatCents(order.totalCents - totalPaidCents)}. This order is{" "}
              {order.paymentStatus === "PARTIALLY_PAID" ? "partially paid" : order.paymentStatus.toLowerCase()} until
              the balance is collected.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" icon={Printer} onClick={() => window.print()} className="flex-1">
              Print receipt
            </Button>
            <Button onClick={onClose} className="flex-1">
              New sale
            </Button>
          </div>
        </div>
      </Modal>

      <ReceiptPrintable sale={sale} cashierName={cashierName} cashierEmployeeId={cashierEmployeeId} />
    </>
  );
}
