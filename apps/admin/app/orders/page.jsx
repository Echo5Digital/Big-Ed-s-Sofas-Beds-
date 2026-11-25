"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import OrderStatusDropdown from "@/components/orders/OrderStatusDropdown";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const PAYMENT_TONE = { UNPAID: "danger", PARTIALLY_PAID: "warning", PAID: "success", REFUNDED: "default" };

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

// Same unified labels as OrderStatusDropdown/orderStatus.service.js's
// displayStatus — filtering on this instead of the raw status/
// fulfillmentStatus enums means "Status: Ordered" here matches exactly the
// rows whose own badge reads "Ordered", regardless of channel.
const DISPLAY_STATUSES = ["Ordered", "Processing", "Ready", "Completed", "Canceled"];
// { value, label } pairs (rather than plain strings like DISPLAY_STATUSES,
// which already read fine as-is) since the raw PaymentStatus enum values
// this sends to the server (PAID/UNPAID) are all-caps and shouldn't be shown
// to staff that way.
const PAYMENT_STATUSES = [
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
];
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
        {options.map((opt) => {
          const optValue = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt.replaceAll("_", " ") : opt.label;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function OrdersContent() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [displayStatus, setDisplayStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  // The latest response, tagged with the query it answers — same
  // "loading is derived from a stale key" pattern as CustomersTab.jsx, so a
  // slow response to an earlier keystroke/filter change can't land after and
  // overwrite a newer one's results.
  const [result, setResult] = useState(null);

  const queryKey = `${debouncedSearch}|${displayStatus}|${paymentStatus}|${channel}|${page}`;
  const loading = result?.key !== queryKey;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  function handleFilterChange(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (displayStatus) params.set("displayStatus", displayStatus);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (channel) params.set("channel", channel);

    api
      .get(`/admin/orders?${params}`)
      .then((data) => {
        if (!cancelled) setResult({ key: queryKey, orders: data.orders, pagination: data.pagination });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({ key: queryKey, error: err instanceof ApiClientError ? err.message : "Failed to load orders." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryKey, debouncedSearch, displayStatus, paymentStatus, channel, page]);

  const orders = result?.orders ?? null;
  const total = result?.pagination?.total ?? 0;
  const pageSize = result?.pagination?.pageSize ?? PAGE_SIZE;
  const shownPage = result?.pagination?.page ?? 1;
  const from = total === 0 ? 0 : (shownPage - 1) * pageSize + 1;
  const to = from + (orders?.length ?? 0) - 1;
  const error = !loading ? result?.error : null;

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
          onUpdated={(updated) =>
            setResult((prev) =>
              prev?.orders
                ? { ...prev, orders: prev.orders.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)) }
                : prev
            )
          }
        />
      ),
    },
    { key: "createdAt", header: "Placed", render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  const emptyMessage = loading
    ? "Loading orders…"
    : debouncedSearch
      ? "No orders match your search."
      : "No orders yet.";

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Online and in-store sales"
        action={
          <div className="flex flex-wrap items-center gap-4">
            <SelectFilter
              label="Status"
              value={displayStatus}
              onChange={handleFilterChange(setDisplayStatus)}
              options={DISPLAY_STATUSES}
            />
            <SelectFilter
              label="Payment"
              value={paymentStatus}
              onChange={handleFilterChange(setPaymentStatus)}
              options={PAYMENT_STATUSES}
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
            onClick={() => handleFilterChange(setChannel)(value)}
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

      <div className="mb-4 max-w-xs">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer name, or email"
            aria-label="Search orders by order number, customer name, or email"
            className="w-full rounded-lg border border-black/15 py-2 pl-9 pr-3 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div aria-busy={loading} className={loading && orders ? "opacity-60 transition-opacity" : undefined}>
        <DataTable columns={columns} rows={orders} rowHref={(o) => `/orders/${o.id}`} emptyMessage={emptyMessage} />
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brand-charcoal/60">
            Showing {from}&ndash;{to} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={loading || page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
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
