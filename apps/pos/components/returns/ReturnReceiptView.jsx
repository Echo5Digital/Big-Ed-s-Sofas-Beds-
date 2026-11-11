"use client";

import { createPortal } from "react-dom";
import { CheckCircle2, Printer } from "lucide-react";
import { formatCents } from "@/lib/format";
import { storeInfo } from "@/lib/storeInfo";
import { useAuth } from "@/lib/hooks/useAuth";
import Button from "../ui/Button";

const REASON_LABELS = {
  CUSTOMER_CHANGED_MIND: "Customer changed mind",
  DAMAGED_PRODUCT: "Damaged product",
  WRONG_PRODUCT: "Wrong product",
  DEFECTIVE_PRODUCT: "Defective product",
  OTHER: "Other",
};

// Mirrors ReceiptView.jsx's print mechanism exactly: renders into its own
// top-level portal node so print.css's "hide everything except this" rule
// only ever targets one receipt root at a time.
function ReturnReceiptPrintable({ result, cashierName }) {
  if (typeof document === "undefined") return null;
  const { returnTransaction, orderData, returnLines, exchangeItems, refund, storeCredit, balanceDueCents } = result;
  const printedAt = new Date();
  const refundAmountCents = refund?.amountCents ?? storeCredit?.amountCents ?? 0;
  const refundMethodLabel = refund ? "Refund" : storeCredit ? "Store Credit Issued" : null;

  return createPortal(
    <div id="return-receipt-print-root" className="hidden">
      <div className="mx-auto w-[80mm] text-black">
        <div className="pb-3 text-center">
          <p className="font-display text-lg font-bold tracking-wide uppercase">{storeInfo.name}</p>
          <p className="mt-1 text-[10px] tracking-wide text-black/70">{storeInfo.address}</p>
          <p className="text-[10px] tracking-wide text-black/70">{storeInfo.phone}</p>
        </div>

        <div className="border-t-2 border-black" />

        <div className="flex items-baseline justify-between py-2 font-mono text-[10px] text-black/70">
          <span>
            Return <span className="font-semibold text-black">{returnTransaction.receiptNumber}</span>
          </span>
          <span>{printedAt.toLocaleString()}</span>
        </div>
        <div className="pb-1 font-mono text-[10px] text-black/70">
          Original order <span className="font-semibold text-black">{orderData.order.orderNumber}</span>
        </div>
        <div className="pb-2 font-mono text-[10px] text-black/70">Cashier: {cashierName}</div>
        {orderData.order.customer && (
          <div className="pb-2 font-mono text-[10px] text-black/70">
            {orderData.order.customer.firstName} {orderData.order.customer.lastName}
          </div>
        )}

        <div className="border-t border-dashed border-black/50" />

        <div className="flex flex-col gap-2 py-3 font-mono text-[11px]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-black/50">Returned</p>
          {returnLines.map((sel) => {
            const line = orderData.lines.find((l) => l.id === sel.orderLineId);
            return (
              <div key={sel.orderLineId} className="flex justify-between gap-3">
                <span className="leading-snug">
                  <span className="font-semibold">{sel.quantity}×</span> {line?.name} ({REASON_LABELS[sel.reasonCode]})
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatCents((line?.unitRefundCents ?? 0) * sel.quantity)}
                </span>
              </div>
            );
          })}
        </div>

        {exchangeItems.length > 0 && (
          <>
            <div className="border-t border-dashed border-black/50" />
            <div className="flex flex-col gap-2 py-3 font-mono text-[11px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-black/50">Replacement</p>
              {exchangeItems.map((item) => (
                <div key={item.variantId} className="flex justify-between gap-3">
                  <span className="leading-snug">
                    <span className="font-semibold">{item.quantity}×</span> {item.productName} — {item.variantName}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatCents(item.priceCents * item.quantity)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="border-t-2 border-black" />

        <div className="flex flex-col gap-1.5 py-3 font-mono text-[11px] text-black/70">
          {refundMethodLabel && (
            <div className="flex justify-between">
              <span>{refundMethodLabel}</span>
              <span className="tabular-nums">{formatCents(refundAmountCents)}</span>
            </div>
          )}
          {balanceDueCents > 0 && (
            <div className="flex justify-between">
              <span>Balance collected</span>
              <span className="tabular-nums">{formatCents(balanceDueCents)}</span>
            </div>
          )}
          {!refundMethodLabel && balanceDueCents === 0 && exchangeItems.length > 0 && (
            <div className="flex justify-between">
              <span>Even exchange</span>
              <span className="tabular-nums">{formatCents(0)}</span>
            </div>
          )}
        </div>

        <div className="border-t-2 border-black" />

        <div className="pt-4 pb-1 text-center">
          <p className="font-display text-sm font-semibold">Thank You For Shopping With Us</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ReturnReceiptView({ result, onDone }) {
  const { user } = useAuth();
  const cashierName = user ? `${user.firstName} ${user.lastName}` : "—";
  const { returnTransaction, refund, storeCredit, balanceDueCents } = result;
  const refundAmountCents = refund?.amountCents ?? storeCredit?.amountCents ?? 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="size-8 text-green-600" aria-hidden="true" />
          </span>
          <p className="font-display text-xl font-bold tabular-nums text-brand-charcoal">
            {refund ? `${formatCents(refundAmountCents)} refunded` : storeCredit ? `${formatCents(refundAmountCents)} store credit issued` : "Exchange complete"}
          </p>
          <p className="text-sm text-brand-charcoal/50">Return {returnTransaction.receiptNumber}</p>
        </div>

        {balanceDueCents > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-center text-sm text-amber-800">
            Balance collected: {formatCents(balanceDueCents)}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" icon={Printer} onClick={() => window.print()} className="flex-1">
            Print receipt
          </Button>
          <Button onClick={onDone} className="flex-1">
            Done
          </Button>
        </div>
      </div>

      <ReturnReceiptPrintable result={result} cashierName={cashierName} />
    </>
  );
}
