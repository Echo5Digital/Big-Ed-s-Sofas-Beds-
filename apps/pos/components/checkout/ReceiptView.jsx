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

function formatAddress(address) {
  if (!address) return null;
  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`]
    .filter(Boolean)
    .join(", ");
}

function ReceiptPrintable({ sale, cashierName, cashierEmployeeId }) {
  if (typeof document === "undefined") return null;
  const { order, payments, receipt, changeDueCents } = sale;
  const totalPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const isDepositOnly = payments.length === 1 && payments[0].method === "DEPOSIT";
  const printedAt = new Date(order.createdAt);
  const billingAddressLine = formatAddress(order.billingAddress);
  const shippingAddressLine = formatAddress(order.shippingAddress);
  const hasDistinctShipping = shippingAddressLine && shippingAddressLine !== billingAddressLine;
  const primaryTenderLabel = TENDER_LABELS[payments[0]?.method] ?? payments[0]?.method ?? "";

  return createPortal(
    <div id="receipt-print-root" className="hidden">
      <div className="mx-auto max-w-2xl bg-white p-8 text-brand-charcoal">
        <div className="flex items-start justify-between gap-6 pb-4">
          <div>
            <p className="font-display text-2xl font-bold uppercase leading-tight">{storeInfo.name}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-charcoal/80">Showroom</p>
            <p className="text-xs text-brand-charcoal/70">{storeInfo.address}</p>
            <p className="text-xs text-brand-charcoal/70">{storeInfo.phone}</p>
          </div>

          <div className="text-right">
            <p className="font-display text-xl font-bold uppercase">Sales Receipt</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-green-700">
              {isDepositOnly ? "Partially Paid" : "Paid"}
            </p>
            <div className="mt-2 flex flex-col gap-0.5 text-xs text-brand-charcoal/70">
              <p>
                Receipt No. <span className="font-semibold text-brand-charcoal">{receipt.receiptNumber}</span>
              </p>
              <p>
                Order No. <span className="font-semibold text-brand-charcoal">{order.orderNumber}</span>
              </p>
              <p>
                Date <span className="font-semibold text-brand-charcoal">{printedAt.toLocaleDateString()}</span>
              </p>
              <p>
                Time <span className="font-semibold text-brand-charcoal">{printedAt.toLocaleTimeString()}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-brand-charcoal" />

        {billingAddressLine && (
          <div className="grid grid-cols-2 gap-6 py-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-charcoal/50">Billing Address</p>
              <p className="text-xs text-brand-charcoal/80">{billingAddressLine}</p>
            </div>
            {hasDistinctShipping && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-charcoal/50">Shipping Address</p>
                <p className="text-xs text-brand-charcoal/80">{shippingAddressLine}</p>
              </div>
            )}
          </div>
        )}

        <p className="pt-4 pb-2 text-xs font-bold uppercase tracking-wide text-brand-charcoal/60">Itemized Purchase</p>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-charcoal text-left text-white">
              <th className="w-16 px-3 py-2 text-xs font-bold uppercase tracking-wide">Qty</th>
              <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide">Description</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-black/10">
                <td className="px-3 py-2.5 align-top">{line.quantity}</td>
                <td className="px-3 py-2.5 align-top font-semibold">{line.name}</td>
                <td className="px-3 py-2.5 text-right align-top tabular-nums">{formatCents(line.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-4">
          <div className="w-72">
            <div className="flex flex-col gap-2 rounded-t-lg bg-brand-cream/70 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-charcoal/70">Subtotal</span>
                <span className="font-semibold tabular-nums">{formatCents(order.subtotalCents)}</span>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-brand-charcoal/70">Discount</span>
                  <span className="font-semibold tabular-nums">-{formatCents(order.discountCents)}</span>
                </div>
              )}
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="text-brand-charcoal/70">{TENDER_LABELS[p.method] ?? p.method} received</span>
                  <span className="font-semibold tabular-nums">{formatCents(p.amountCents)}</span>
                </div>
              ))}
              {changeDueCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-brand-charcoal/70">Change returned</span>
                  <span className="font-semibold tabular-nums">{formatCents(changeDueCents)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-b-lg bg-brand-charcoal px-3 py-3 text-white">
              <span className="font-display text-sm font-bold uppercase tracking-wide">
                {isDepositOnly ? "Deposit Paid" : "Total Paid"}
              </span>
              <span className="font-display text-base font-bold tabular-nums">{formatCents(totalPaidCents)}</span>
            </div>
          </div>
        </div>

        <div className="pt-8 pb-4 text-center">
          <p className="font-display text-base font-bold uppercase">Thank You For Shopping With Us!</p>
          <p className="mt-1 text-xs tracking-[0.15em] text-brand-charcoal/50 uppercase">Your Home. Our Passion.</p>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 text-xs">
          <div className="bg-brand-cream/50 p-3">
            <p className="font-bold uppercase tracking-wide text-brand-charcoal/60">Visit Our Showroom</p>
            <p className="mt-1 text-brand-charcoal/80">{storeInfo.address}</p>
          </div>
          <div className="bg-brand-cream/50 p-3">
            <p className="font-bold uppercase tracking-wide text-brand-charcoal/60">Call Us</p>
            <p className="mt-1 text-brand-charcoal/80">{storeInfo.phone}</p>
          </div>
          <div className="bg-brand-cream/50 p-3">
            <p className="font-bold uppercase tracking-wide text-brand-charcoal/60">Payment</p>
            <p className="mt-1 text-brand-charcoal/80">{primaryTenderLabel}</p>
          </div>
        </div>

        <p className="pt-4 text-center text-[10px] text-brand-charcoal/40">
          Cashier: {cashierName}
          {cashierEmployeeId ? ` (${cashierEmployeeId})` : ""}
        </p>
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
