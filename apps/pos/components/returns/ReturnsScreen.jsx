"use client";

import { useState, useMemo } from "react";
import { Search, Minus, Plus, Trash2, ArrowLeftRight } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCents } from "@/lib/format";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import ProductThumbnail from "../ui/ProductThumbnail";
import ProductSearch from "../checkout/ProductSearch";
import ReturnPaymentModal from "./ReturnPaymentModal";
import ReturnReceiptView from "./ReturnReceiptView";

const CONDITIONS = [
  { key: "SELLABLE", label: "Sellable" },
  { key: "DAMAGED", label: "Damaged" },
  { key: "QUARANTINED", label: "Quarantined" },
  { key: "REQUIRES_INSPECTION", label: "Requires inspection" },
];

const REASONS = [
  { key: "CUSTOMER_CHANGED_MIND", label: "Customer changed mind" },
  { key: "DAMAGED_PRODUCT", label: "Damaged product" },
  { key: "WRONG_PRODUCT", label: "Wrong product" },
  { key: "DEFECTIVE_PRODUCT", label: "Defective product" },
  { key: "OTHER", label: "Other" },
];

function FindOrderStep({ onFound }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.get(`/pos/returns/find-order?q=${encodeURIComponent(query.trim())}`);
      onFound(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to find a matching order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex flex-col gap-3">
      <p className="text-sm text-brand-charcoal/60">
        Search by receipt number, order number, or customer phone number.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal/40" aria-hidden="true" />
        <input
          autoFocus
          type="text"
          placeholder="Receipt #, order #, or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-black/15 py-3 pl-10 pr-3 text-base focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading || !query.trim()}>
        {loading ? "Searching…" : "Find order"}
      </Button>
    </form>
  );
}

function OrderSummary({ orderData }) {
  const { order } = orderData;
  return (
    <div className="rounded-lg bg-brand-cream/60 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-brand-charcoal">Order {order.orderNumber}</span>
        <Badge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>{order.paymentStatus}</Badge>
      </div>
      <p className="mt-0.5 text-xs text-brand-charcoal/50">
        {new Date(order.createdAt).toLocaleString()}
        {order.customer && ` · ${order.customer.firstName} ${order.customer.lastName}`}
      </p>
    </div>
  );
}

function SelectLinesStep({ orderData, selections, onToggle, onQuantity, onCondition, onReason, onNext }) {
  return (
    <div className="flex flex-col gap-3">
      <OrderSummary orderData={orderData} />
      <ul className="flex flex-col gap-3">
        {orderData.lines.map((line) => {
          const selected = selections[line.id];
          return (
            <li key={line.id} className="rounded-lg border border-black/10 p-3">
              <div className="flex items-start gap-3">
                <ProductThumbnail src={line.imageUrl} alt={line.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brand-charcoal">{line.name}</p>
                  <p className="text-xs text-brand-charcoal/50">
                    SKU {line.sku} · Qty {line.quantity} · {formatCents(line.unitPriceCents)} each
                  </p>
                  <p className="text-xs text-brand-charcoal/50">
                    Previously returned: {line.previouslyReturnedQty} · Eligible: {line.eligibleQty}
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-charcoal">
                  <input
                    type="checkbox"
                    disabled={line.eligibleQty <= 0}
                    checked={Boolean(selected)}
                    onChange={(e) => onToggle(line, e.target.checked)}
                  />
                  Return
                </label>
              </div>

              {selected && (
                <div className="mt-3 flex flex-col gap-2 border-t border-black/10 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-brand-charcoal/60">Return qty</span>
                    <button
                      type="button"
                      onClick={() => onQuantity(line, selected.quantity - 1)}
                      className="flex size-7 items-center justify-center rounded-full bg-black/5 hover:bg-black/10"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{selected.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onQuantity(line, selected.quantity + 1)}
                      disabled={selected.quantity >= line.eligibleQty}
                      className="flex size-7 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 disabled:opacity-40"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                    <span className="ml-auto text-sm font-semibold tabular-nums text-brand-charcoal">
                      {formatCents(line.unitRefundCents * selected.quantity)} refund
                    </span>
                  </div>

                  <select
                    value={selected.condition}
                    onChange={(e) => onCondition(line, e.target.value)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selected.reasonCode}
                    onChange={(e) => onReason(line, e.target.value)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm"
                  >
                    {REASONS.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button disabled={Object.keys(selections).length === 0} onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

function ExchangeStep({ exchangeItems, onAdd, onRemove, onQuantity, onSkip, onNext }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-brand-charcoal/60">
        Optionally add a replacement product for an exchange, or skip to process this as a plain return.
      </p>

      {exchangeItems.length > 0 && (
        <ul className="flex flex-col gap-2">
          {exchangeItems.map((item) => (
            <li key={item.variantId} className="flex items-center justify-between gap-2 rounded-lg border border-black/10 p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <ProductThumbnail src={item.imageUrl} alt={item.productName} />
                <span className="truncate text-sm font-medium text-brand-charcoal">
                  {item.productName} — {item.variantName}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onQuantity(item.variantId, item.quantity - 1)}
                  className="flex size-7 items-center justify-center rounded-full bg-black/5 hover:bg-black/10"
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                </button>
                <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onQuantity(item.variantId, item.quantity + 1)}
                  className="flex size-7 items-center justify-center rounded-full bg-black/5 hover:bg-black/10"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
                <span className="w-16 text-right text-sm font-semibold tabular-nums">
                  {formatCents(item.priceCents * item.quantity)}
                </span>
                <button
                  type="button"
                  aria-label="Remove replacement item"
                  onClick={() => onRemove(item.variantId)}
                  className="flex size-7 items-center justify-center rounded-full text-brand-charcoal/35 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="h-72 rounded-lg border border-black/10 p-2">
        <ProductSearch onAdd={onAdd} />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip} className="flex-1">
          Skip (plain return)
        </Button>
        <Button onClick={onNext} disabled={exchangeItems.length === 0} className="flex-1">
          Continue with exchange
        </Button>
      </div>
    </div>
  );
}

export default function ReturnsScreen({ open, onClose }) {
  const { session } = useRegisterSession();
  const [step, setStep] = useState("find"); // find | lines | exchange | payment | receipt
  const [orderData, setOrderData] = useState(null);
  const [selections, setSelections] = useState({});
  const [exchangeItems, setExchangeItems] = useState([]);
  const [completedReturn, setCompletedReturn] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("find");
    setOrderData(null);
    setSelections({});
    setExchangeItems([]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFound(data) {
    setOrderData(data);
    setSelections({});
    setStep("lines");
  }

  function handleToggle(line, checked) {
    setSelections((prev) => {
      const next = { ...prev };
      if (checked) {
        next[line.id] = { orderLineId: line.id, quantity: Math.min(1, line.eligibleQty), condition: "SELLABLE", reasonCode: "CUSTOMER_CHANGED_MIND" };
      } else {
        delete next[line.id];
      }
      return next;
    });
  }

  function handleQuantity(line, quantity) {
    const clamped = Math.max(1, Math.min(quantity, line.eligibleQty));
    setSelections((prev) => ({ ...prev, [line.id]: { ...prev[line.id], quantity: clamped } }));
  }

  function handleCondition(line, condition) {
    setSelections((prev) => ({ ...prev, [line.id]: { ...prev[line.id], condition } }));
  }

  function handleReason(line, reasonCode) {
    setSelections((prev) => ({ ...prev, [line.id]: { ...prev[line.id], reasonCode } }));
  }

  function handleAddExchangeItem(row) {
    setExchangeItems((prev) => {
      const existing = prev.find((i) => i.variantId === row.variantId);
      if (existing) {
        return prev.map((i) => (i.variantId === row.variantId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          variantId: row.variantId,
          productName: row.productName,
          variantName: row.variantName,
          priceCents: row.priceCents,
          imageUrl: row.imageUrl,
          quantity: 1,
        },
      ];
    });
  }

  function handleExchangeQuantity(variantId, quantity) {
    if (quantity <= 0) {
      setExchangeItems((prev) => prev.filter((i) => i.variantId !== variantId));
      return;
    }
    setExchangeItems((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)));
  }

  function handleExchangeRemove(variantId) {
    setExchangeItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  const returnLines = useMemo(() => Object.values(selections), [selections]);
  const eligibleRefundCents = useMemo(() => {
    return returnLines.reduce((sum, sel) => {
      const line = orderData?.lines.find((l) => l.id === sel.orderLineId);
      return sum + (line ? line.unitRefundCents * sel.quantity : 0);
    }, 0);
  }, [returnLines, orderData]);
  const replacementTotalCents = useMemo(
    () => exchangeItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    [exchangeItems]
  );
  const diffCents = replacementTotalCents - eligibleRefundCents;

  async function submitReturn({ refundMethod, paymentId, balancePayments }) {
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post("/pos/returns", {
        orderId: orderData.order.id,
        registerSessionId: session.id,
        lines: returnLines,
        refundMethod,
        paymentId,
        exchangeReplacements: exchangeItems.length
          ? exchangeItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
          : undefined,
        balancePayments,
      });
      setCompletedReturn({ ...result, orderData, returnLines, exchangeItems, eligibleRefundCents, replacementTotalCents });
      setStep("receipt");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to process this return");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Returns & exchanges">
      {step === "find" && <FindOrderStep onFound={handleFound} />}

      {step === "lines" && orderData && (
        <SelectLinesStep
          orderData={orderData}
          selections={selections}
          onToggle={handleToggle}
          onQuantity={handleQuantity}
          onCondition={handleCondition}
          onReason={handleReason}
          onNext={() => setStep("exchange")}
        />
      )}

      {step === "exchange" && (
        <ExchangeStep
          exchangeItems={exchangeItems}
          onAdd={handleAddExchangeItem}
          onRemove={handleExchangeRemove}
          onQuantity={handleExchangeQuantity}
          onSkip={() => {
            setExchangeItems([]);
            setStep("payment");
          }}
          onNext={() => setStep("payment")}
        />
      )}

      {step === "payment" && (
        <ReturnPaymentModal
          eligibleRefundCents={eligibleRefundCents}
          replacementTotalCents={replacementTotalCents}
          diffCents={diffCents}
          hasExchange={exchangeItems.length > 0}
          customer={orderData?.order?.customer}
          submitting={submitting}
          error={error}
          onConfirm={submitReturn}
        />
      )}

      {step === "receipt" && completedReturn && (
        <ReturnReceiptView result={completedReturn} onDone={handleClose} />
      )}
    </Modal>
  );
}
