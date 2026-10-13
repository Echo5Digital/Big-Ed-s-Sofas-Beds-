"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const PAYMENT_TONE = { UNPAID: "danger", PARTIALLY_PAID: "warning", PAID: "success", REFUNDED: "default" };
const FULFILLMENT_TONE = {
  UNALLOCATED: "default",
  RESERVED: "info",
  READY: "warning",
  PICKED_UP: "success",
  DELIVERED: "success",
};

function OrdersContent() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/admin/orders")
      .then((data) => setOrders(data.orders))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load orders."));
  }, []);

  const columns = [
    { key: "orderNumber", header: "Order #" },
    { key: "channel", header: "Channel" },
    { key: "customer", header: "Customer", render: (o) => (o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : "—") },
    { key: "total", header: "Total", render: (o) => formatCentsAsCurrency(o.totalCents) },
    { key: "paymentStatus", header: "Payment", render: (o) => <Badge tone={PAYMENT_TONE[o.paymentStatus]}>{o.paymentStatus.replaceAll("_", " ")}</Badge> },
    {
      key: "fulfillmentStatus",
      header: "Fulfillment",
      render: (o) => <Badge tone={FULFILLMENT_TONE[o.fulfillmentStatus]}>{o.fulfillmentStatus.replaceAll("_", " ")}</Badge>,
    },
    { key: "createdAt", header: "Placed", render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title="Orders" subtitle="Online and in-store sales (filter by status coming soon)" />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataTable columns={columns} rows={orders} emptyMessage="No orders yet." />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}
