"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const STATUS_TONE = { DRAFT: "default", CONFIRMED: "info", CANCELED: "danger", CLOSED: "success" };
const PAYMENT_TONE = { UNPAID: "danger", PARTIALLY_PAID: "warning", PAID: "success", REFUNDED: "default" };
const FULFILLMENT_TONE = {
  UNALLOCATED: "default",
  RESERVED: "info",
  READY: "warning",
  PICKED_UP: "success",
  DELIVERED: "success",
};
const PAYMENT_DETAIL_TONE = { PENDING: "warning", SUCCEEDED: "success", FAILED: "danger", VOIDED: "default" };

function label(value) {
  return value ? String(value).replaceAll("_", " ") : "—";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatAddress(address) {
  if (!address) return null;
  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`, address.country]
    .filter(Boolean)
    .join(", ");
}

function BackToOrdersLink() {
  return (
    <Link
      href="/orders"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-charcoal/60 hover:text-brand-red"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to Orders
    </Link>
  );
}

function SummaryRow({ label: rowLabel, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-brand-charcoal/60">{rowLabel}</span>
      <span className={strong ? "font-semibold text-brand-charcoal" : "text-brand-charcoal"}>{value}</span>
    </div>
  );
}

function OrderDetailContent() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/admin/orders/${id}`)
      .then((data) => setOrder(data.order))
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(err instanceof ApiClientError ? err.message : "Failed to load order.");
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound) {
    return (
      <div>
        <BackToOrdersLink />
        <PageHeader title="Order not found" />
        <p className="text-sm text-brand-charcoal/60">This order doesn&apos;t exist or may have been removed.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <BackToOrdersLink />
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <BackToOrdersLink />
        <p className="text-sm text-brand-charcoal/50">Loading…</p>
      </div>
    );
  }

  const customerName = order.customer ? `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() : null;
  const delivery = order.deliveries[0] ?? null;
  const pickup = order.pickups[0] ?? null;
  const deliveryAddress = delivery?.address ?? order.deliveryAddress;

  const lineColumns = [
    {
      key: "item",
      header: "Item",
      render: (l) => (
        <div className="flex min-w-0 items-center gap-3">
          {l.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured product image hosts (next/image requires remotePatterns this app doesn't set up)
            <img src={l.imageUrl} alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="size-10 shrink-0 rounded-lg bg-black/5" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-brand-charcoal">{l.name}</p>
            <p className="text-xs text-brand-charcoal/50">{l.sku}</p>
          </div>
        </div>
      ),
    },
    { key: "quantity", header: "Qty" },
    { key: "unitPrice", header: "Unit Price", render: (l) => formatCentsAsCurrency(l.unitPriceCents) },
    {
      key: "discount",
      header: "Discount",
      render: (l) => (l.discountCents ? `-${formatCentsAsCurrency(l.discountCents)}` : "—"),
    },
    { key: "lineTotal", header: "Line Total", render: (l) => formatCentsAsCurrency(l.lineTotalCents) },
  ];

  const paymentColumns = [
    { key: "createdAt", header: "Date", render: (p) => formatDateTime(p.createdAt) },
    { key: "method", header: "Method", render: (p) => label(p.method) },
    { key: "amount", header: "Amount", render: (p) => formatCentsAsCurrency(p.amountCents) },
    { key: "status", header: "Status", render: (p) => <Badge tone={PAYMENT_DETAIL_TONE[p.status]}>{label(p.status)}</Badge> },
    {
      key: "reference",
      header: "Reference",
      render: (p) => p.reference || p.providerRef || "—",
    },
    {
      key: "performedBy",
      header: "By",
      render: (p) => (p.performedBy ? `${p.performedBy.firstName} ${p.performedBy.lastName}` : "—"),
    },
  ];

  const refundColumns = [
    { key: "createdAt", header: "Date", render: (r) => formatDateTime(r.createdAt) },
    { key: "amount", header: "Amount", render: (r) => formatCentsAsCurrency(r.amountCents) },
    { key: "reasonCode", header: "Reason", render: (r) => label(r.reasonCode) },
    { key: "notes", header: "Notes", render: (r) => r.notes || "—" },
  ];

  const historyColumns = [
    { key: "createdAt", header: "Date", render: (h) => formatDateTime(h.createdAt) },
    { key: "field", header: "Field", render: (h) => label(h.field) },
    { key: "change", header: "Change", render: (h) => `${label(h.fromValue) || "—"} → ${label(h.toValue)}` },
    { key: "note", header: "Note", render: (h) => h.note || "—" },
  ];

  return (
    <div>
      <BackToOrdersLink />

      <PageHeader
        title={order.orderNumber}
        subtitle={`${label(order.channel)} order placed ${formatDateTime(order.createdAt)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[order.status]}>{label(order.status)}</Badge>
            <Badge tone={PAYMENT_TONE[order.paymentStatus]}>{label(order.paymentStatus)}</Badge>
            <Badge tone={FULFILLMENT_TONE[order.fulfillmentStatus]}>{label(order.fulfillmentStatus)}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold text-brand-charcoal">Totals</h2>
          <SummaryRow label="Subtotal" value={formatCentsAsCurrency(order.subtotalCents)} />
          <SummaryRow label="Tax" value={formatCentsAsCurrency(order.taxCents)} />
          <SummaryRow label="Delivery Fee" value={formatCentsAsCurrency(order.deliveryFeeCents)} />
          {order.discountCents > 0 && <SummaryRow label="Discount" value={`-${formatCentsAsCurrency(order.discountCents)}`} />}
          <div className="my-1 border-t border-black/10" />
          <SummaryRow label="Total" value={formatCentsAsCurrency(order.totalCents)} strong />
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold text-brand-charcoal">Customer</h2>
          {order.customer ? (
            <>
              <SummaryRow label="Name" value={customerName || "—"} />
              <SummaryRow label="Email" value={order.customer.email || "—"} />
              <SummaryRow label="Phone" value={order.customer.phone || "—"} />
            </>
          ) : (
            <p className="text-sm text-brand-charcoal/50">Guest checkout</p>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold text-brand-charcoal">Fulfillment</h2>
          <SummaryRow label="Method" value={label(order.fulfillmentMethod)} />
          {order.fulfillmentMethod === "DELIVERY" && (
            <>
              <SummaryRow label="Scheduled" value={formatDateTime(delivery?.scheduledDate ?? order.scheduledDate)} />
              <SummaryRow label="Delivered" value={formatDateTime(delivery?.deliveredAt)} />
              {deliveryAddress && <SummaryRow label="Address" value={formatAddress(deliveryAddress)} />}
            </>
          )}
          {order.fulfillmentMethod === "PICKUP" && (
            <>
              <SummaryRow label="Scheduled" value={formatDateTime(pickup?.scheduledDate ?? order.scheduledDate)} />
              <SummaryRow label="Picked Up" value={formatDateTime(pickup?.pickedUpAt)} />
            </>
          )}
          {order.deliveryNotes && <SummaryRow label="Delivery Notes" value={order.deliveryNotes} />}
          {order.assemblyNotes && <SummaryRow label="Assembly Notes" value={order.assemblyNotes} />}
        </Card>
      </div>

      <h2 className="mt-6 mb-3 font-display text-sm font-bold text-brand-charcoal">Items</h2>
      <DataTable columns={lineColumns} rows={order.lines} emptyMessage="No line items." />

      <h2 className="mt-6 mb-3 font-display text-sm font-bold text-brand-charcoal">Payments</h2>
      <DataTable columns={paymentColumns} rows={order.payments} emptyMessage="No payments recorded." />

      {order.refunds.length > 0 && (
        <>
          <h2 className="mt-6 mb-3 font-display text-sm font-bold text-brand-charcoal">Refunds</h2>
          <DataTable columns={refundColumns} rows={order.refunds} emptyMessage="No refunds." />
        </>
      )}

      {order.statusHistory.length > 0 && (
        <>
          <h2 className="mt-6 mb-3 font-display text-sm font-bold text-brand-charcoal">Status History</h2>
          <DataTable columns={historyColumns} rows={order.statusHistory} emptyMessage="No status changes." />
        </>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth permission="orders:read">
      <OrderDetailContent />
    </RequireAuth>
  );
}
