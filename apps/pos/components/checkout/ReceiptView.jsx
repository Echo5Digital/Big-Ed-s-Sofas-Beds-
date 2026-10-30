"use client";

import { createPortal } from "react-dom";
import { CheckCircle2, Printer } from "lucide-react";
import { formatCents } from "@/lib/format";
import { storeInfo } from "@/lib/storeInfo";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

// Renders into its own top-level node (a sibling of the app root, not nested
// inside the "Sale complete" modal) so the print.css rule in globals.css can
// hide literally everything else in the document and print only this —
// otherwise window.print() captures the whole page behind the modal too.
function ReceiptPrintable({ sale }) {
  if (typeof document === "undefined") return null;
  const { order, payment, receipt, changeDueCents } = sale;
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
        <div className="pb-2 font-mono text-[10px] text-black/70">
          Order <span className="font-semibold text-black">{order.orderNumber}</span>
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

        <div className="flex items-center justify-between py-2.5">
          <span className="font-display text-sm font-bold uppercase tracking-wide">
            {payment.method === "DEPOSIT" ? "Deposit Paid" : "Total Paid"}
          </span>
          <span className="font-mono text-base font-bold tabular-nums">{formatCents(payment.amountCents)}</span>
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
  if (!sale) return null;
  const { order, payment, receipt, changeDueCents } = sale;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Sale complete">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="size-8 text-green-600" aria-hidden="true" />
            </span>
            <p className="font-display text-xl font-bold tabular-nums text-brand-charcoal">
              {formatCents(payment.amountCents)} {payment.method === "DEPOSIT" ? "deposit" : "paid"}
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
              <div className="flex justify-between font-semibold">
                <span>{payment.method === "DEPOSIT" ? "Deposit paid" : "Total paid"}</span>
                <span>{formatCents(payment.amountCents)}</span>
              </div>
              {changeDueCents > 0 && (
                <div className="flex justify-between">
                  <span>Change due</span>
                  <span>{formatCents(changeDueCents)}</span>
                </div>
              )}
            </div>
          </div>

          {payment.method === "DEPOSIT" && order.totalCents > payment.amountCents && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              Remaining balance: {formatCents(order.totalCents - payment.amountCents)}. This order is{" "}
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

      <ReceiptPrintable sale={sale} />
    </>
  );
}
