"use client";

import { CheckCircle2, Printer } from "lucide-react";
import { formatCents } from "@/lib/format";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function ReceiptView({ open, onClose, sale }) {
  if (!sale) return null;
  const { order, payment, receipt, changeDueCents } = sale;

  return (
    <Modal open={open} onClose={onClose} title="Sale complete">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="size-10 text-green-600" aria-hidden="true" />
          <p className="font-display text-lg font-bold text-brand-charcoal">
            {formatCents(payment.amountCents)} {payment.method === "DEPOSIT" ? "deposit" : "paid"}
          </p>
          <p className="text-sm text-brand-charcoal/60">
            Receipt {receipt.receiptNumber} · Order {order.orderNumber}
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-black/15 p-4 font-mono text-xs text-brand-charcoal">
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
            {order.paymentStatus === "PARTIALLY_PAID" ? "partially paid" : order.paymentStatus.toLowerCase()} until the
            balance is collected.
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
  );
}
