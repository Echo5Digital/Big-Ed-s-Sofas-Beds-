"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import OrderStatusDropdown from "@/components/orders/OrderStatusDropdown";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const PAYMENT_TONE = { UNPAID: "danger", PARTIALLY_PAID: "warning", PAID: "success", REFUNDED: "default" };

const ORDER_STATUSES = ["DRAFT", "CONFIRMED", "CANCELED", "CLOSED"];
const FULFILLMENT_STATUSES = ["UNALLOCATED", "RESERVED", "PROCESSING", "READY", "PICKED_UP", "DELIVERED"];
const CHANNEL_TABS = [
  { value: "", label: "All" },
  { value: "POS", label: "POS" },
  { value: "ONLINE", label: "Online" },
];

function SelectFilter({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function OrdersContent() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [channel, setChannel] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (fulfillmentStatus) params.set("fulfillmentStatus", fulfillmentStatus);
    if (channel) params.set("channel", channel);
    const query = params.toString();
    api
      .get(`/admin/orders${query ? `?${query}` : ""}`)
      .then((data) => setOrders(data.orders))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load orders."));
  }, [status, fulfillmentStatus, channel]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: "orderNumber",
      header: "Order #",
      render: (o) => (
        <Link href={`/orders/${o.id}`} className="font-semibold text-brand-red hover:text-brand-red-dark">
          {o.orderNumber}
        </Link>
      ),
    },
    { key: "channel", header: "Channel" },
    { key: "customer", header: "Customer", render: (o) => (o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : "—") },
    { key: "total", header: "Total", render: (o) => formatCentsAsCurrency(o.totalCents) },
    { key: "paymentStatus", header: "Payment", render: (o) => <Badge tone={PAYMENT_TONE[o.paymentStatus]}>{o.paymentStatus.replaceAll("_", " ")}</Badge> },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <OrderStatusDropdown
          order={o}
          onUpdated={(updated) => setOrders((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))}
        />
      ),
    },
    { key: "createdAt", header: "Placed", render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Online and in-store sales"
        action={
          <div className="flex flex-wrap items-center gap-4">
            <SelectFilter label="Status" value={status} onChange={setStatus} options={ORDER_STATUSES} />
            <SelectFilter
              label="Fulfillment"
              value={fulfillmentStatus}
              onChange={setFulfillmentStatus}
              options={FULFILLMENT_STATUSES}
            />
          </div>
        }
      />

      <div role="tablist" aria-label="Order type" className="mb-6 flex gap-1 border-b border-black/10">
        {CHANNEL_TABS.map(({ value, label }) => (
          <button
            key={value || "all"}
            type="button"
            role="tab"
            aria-selected={channel === value}
            onClick={() => setChannel(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
              channel === value
                ? "border-brand-red text-brand-red"
                : "border-transparent text-brand-charcoal/60 hover:text-brand-charcoal"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataTable columns={columns} rows={orders} rowHref={(o) => `/orders/${o.id}`} emptyMessage="No orders yet." />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth permission="orders:read">
      <OrdersContent />
    </RequireAuth>
  );
}
