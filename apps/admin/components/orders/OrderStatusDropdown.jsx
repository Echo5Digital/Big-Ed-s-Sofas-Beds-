"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";

// Unified staff-facing status (see apps/api/src/services/orderStatus.service.js)
// — a computed label derived from Order.status/paymentStatus/fulfillmentStatus,
// never stored directly. "Draft" and "Canceled" are display-only states (shown
// when they apply, never offered as a dropdown target): Draft is a read of
// payment state reversed only by settleBalance/refund, and canceling is a
// separate, higher-stakes action this control doesn't perform.
const DISPLAY_STATUS_TONE = {
  Draft: "default",
  Ordered: "info",
  Processing: "warning",
  Ready: "warning",
  Completed: "success",
  Canceled: "danger",
};

const TARGET_STATUSES_BY_CHANNEL = {
  ONLINE: ["Ordered", "Processing", "Ready", "Completed"],
  POS: ["Ordered", "Ready", "Completed"],
};

// Shared by the Orders list (one row) and detail page (header) — a single
// component so the two never diverge on when the control is interactive vs.
// a plain badge. `order` needs { id, channel, displayStatus }.
// `onUpdated(updatedOrderPatch)` fires with the PATCH response's `order`
// object on success — callers decide whether to locally patch a row or
// re-fetch the whole record (see the list vs. detail page usage).
export default function OrderStatusDropdown({ order, onUpdated }) {
  const { hasPermission } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canEdit = hasPermission("orders:write") && order.displayStatus !== "Canceled";
  const tone = DISPLAY_STATUS_TONE[order.displayStatus] ?? "default";

  if (!canEdit) {
    return <Badge tone={tone}>{order.displayStatus}</Badge>;
  }

  const targets = TARGET_STATUSES_BY_CHANNEL[order.channel] ?? TARGET_STATUSES_BY_CHANNEL.ONLINE;

  async function handleChange(event) {
    const nextStatus = event.target.value;
    if (nextStatus === order.displayStatus) return;

    setSubmitting(true);
    setError(null);
    try {
      const data = await api.patch(`/admin/orders/${order.id}/status`, { displayStatus: nextStatus });
      onUpdated(data.order);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update status.");
    } finally {
      setSubmitting(false);
    }
  }

  // Styled as a Badge-shaped pill rather than a plain boxy <select> — same
  // native-select-with-custom-classes approach this app's SelectFilter
  // already uses for filters, just sized/colored to read as a status chip.
  const toneSelectClass = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  }[tone];

  return (
    <div className="inline-flex flex-col gap-1">
      <select
        value={targets.includes(order.displayStatus) ? order.displayStatus : ""}
        onChange={handleChange}
        disabled={submitting}
        aria-label={`Status for order ${order.orderNumber ?? order.id}`}
        className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-red disabled:opacity-50 ${toneSelectClass}`}
      >
        {/* Shown only for a display-only current value (e.g. "Draft") that
            isn't itself a valid target — browsers select nothing from the
            real options below until the manager picks one. */}
        {!targets.includes(order.displayStatus) && (
          <option value="" disabled>
            {order.displayStatus}
          </option>
        )}
        {targets.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
