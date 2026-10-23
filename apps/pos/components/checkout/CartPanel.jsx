"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/format";
import Button from "../ui/Button";

export default function CartPanel({ cart, onUpdateQuantity, onRemove, onTakePayment, subtotalCents }) {
  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-brand-charcoal/60">
        Order summary
      </h2>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-brand-charcoal/50">Cart is empty</p>
          <p className="text-xs text-brand-charcoal/35">Scan or search to add items.</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {cart.map((line) => (
            <li key={line.variantId} className="flex items-center justify-between gap-2 border-b border-black/6 py-3 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-charcoal">
                  {line.productName} — {line.variantName}
                </p>
                <p className="text-xs text-brand-charcoal/50">{formatCents(line.priceCents)} each</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => onUpdateQuantity(line.variantId, line.quantity - 1)}
                  className="flex size-8 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10 active:scale-95"
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => onUpdateQuantity(line.variantId, line.quantity + 1)}
                  disabled={line.quantity >= line.maxAvailable}
                  className="flex size-8 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-brand-charcoal">
                {formatCents(line.priceCents * line.quantity)}
              </span>

              <button
                type="button"
                aria-label="Remove item"
                onClick={() => onRemove(line.variantId)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-black/10 pt-4">
        <div className="flex items-center justify-between text-sm text-brand-charcoal/70">
          <span>Subtotal</span>
          <span className="font-semibold tabular-nums text-brand-charcoal">{formatCents(subtotalCents)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-brand-charcoal/45">
          <span>Tax</span>
          <span>Calculated at tender</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-2 text-base">
          <span className="font-semibold text-brand-charcoal">Total due</span>
          <span className="font-display text-lg font-bold tabular-nums text-brand-red">{formatCents(subtotalCents)}</span>
        </div>

        <Button
          size="lg"
          disabled={cart.length === 0}
          onClick={onTakePayment}
          className="mt-4 w-full"
        >
          Take payment
        </Button>
      </div>
    </div>
  );
}
