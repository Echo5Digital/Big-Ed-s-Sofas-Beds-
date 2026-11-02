"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DollarSign,
  CalendarDays,
  Wallet,
  PiggyBank,
  Undo2,
  XCircle,
  Globe,
  CreditCard,
  Banknote,
  Landmark,
} from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const STATUS_TONE = { PENDING: "warning", SUCCEEDED: "success", FAILED: "danger", VOIDED: "default" };
const METHODS = ["CASH", "CARD", "DEPOSIT", "BANK_TRANSFER"];
const STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "VOIDED"];
const SOURCES = ["ONLINE", "POS"];

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

function StatsGrid({ stats }) {
  const v = (cents) => (stats ? formatCentsAsCurrency(cents) : "—");
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Collected Today" value={v(stats?.collectedTodayCents)} icon={DollarSign} tone="success" />
      <StatCard label="Collected This Month" value={v(stats?.collectedMonthCents)} icon={CalendarDays} tone="default" />
      <StatCard label="Outstanding Balances" value={v(stats?.outstandingCents)} icon={Wallet} tone="warning" />
      <StatCard label="Deposits Collected" value={v(stats?.depositsCollectedCents)} icon={PiggyBank} tone="gold" />
      <StatCard label="Total Refunds" value={v(stats?.refundsCents)} icon={Undo2} tone="red" />
      <StatCard label="Failed Transactions" value={stats ? stats.failedTransactions : "—"} icon={XCircle} tone="red" />
      <StatCard label="Online Payment Revenue" value={v(stats?.onlineRevenueCents)} icon={Globe} tone="default" />
      <StatCard label="POS Card Revenue" value={v(stats?.posCardRevenueCents)} icon={CreditCard} tone="default" />
      <StatCard label="Cash Revenue" value={v(stats?.cashRevenueCents)} icon={Banknote} tone="default" />
      <StatCard label="Bank Transfer Revenue" value={v(stats?.bankTransferRevenueCents)} icon={Landmark} tone="default" />
    </div>
  );
}

function PaymentDetailPanel({ paymentId, onClose }) {
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/payments/${paymentId}`)
      .then((data) => !cancelled && setPayment(data.payment))
      .catch((err) => !cancelled && setError(err instanceof ApiClientError ? err.message : "Failed to load payment."));
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-brand-charcoal">Payment detail</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-charcoal/60 hover:bg-black/5">
            <XCircle className="size-5" aria-hidden="true" />
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!payment && !error && <p className="text-sm text-brand-charcoal/60">Loading…</p>}

        {payment && (
          <div className="flex flex-col gap-4 text-sm">
            <DetailRow label="Transaction ID" value={payment.id} mono />
            <DetailRow label="Order" value={payment.orderNumber} />
            <DetailRow label="Customer" value={payment.customerName} hint={payment.customerEmail} />
            <DetailRow label="Payment method" value={payment.method.replaceAll("_", " ")} />
            <DetailRow label="Payment source" value={payment.source === "ONLINE" ? "Online storefront" : "Point of sale"} />
            <DetailRow label="Amount" value={`${formatCentsAsCurrency(payment.amountCents)} ${payment.currency}`} />
            <DetailRow
              label="Status"
              value={<Badge tone={STATUS_TONE[payment.status]}>{payment.status}</Badge>}
            />
            <DetailRow label="Stripe reference" value={payment.providerRef || "—"} mono />
            {payment.failureReason && <DetailRow label="Failure reason" value={payment.failureReason} />}
            <DetailRow label="Recorded by" value={payment.recordedBy} />
            <DetailRow label="Date & time" value={new Date(payment.createdAt).toLocaleString()} />

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
                Refund history
              </h3>
              {payment.refunds.length === 0 ? (
                <p className="text-sm text-brand-charcoal/50">No refunds recorded on this order.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {payment.refunds.map((r) => (
                    <li key={r.id} className="rounded-lg border border-black/10 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-brand-charcoal">{formatCentsAsCurrency(r.amountCents)}</span>
                        <span className="text-xs text-brand-charcoal/50">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-brand-charcoal/60">{r.reasonCode}</p>
                      {r.notes && <p className="mt-1 text-xs text-brand-charcoal/50">{r.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, hint, mono }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">{label}</p>
      <p className={`mt-0.5 text-brand-charcoal ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-brand-charcoal/40">{hint}</p>}
    </div>
  );
}

function PaymentsContent() {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState(null);
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const loadStats = useCallback(() => {
    api
      .get("/payments/stats")
      .then(setStats)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load payment stats."));
  }, []);

  const loadPayments = useCallback(() => {
    const params = new URLSearchParams();
    if (method) params.set("method", method);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    if (q) params.set("q", q);
    const query = params.toString();
    api
      .get(`/payments${query ? `?${query}` : ""}`)
      .then((data) => setPayments(data.payments))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load payments."));
  }, [method, status, source, q]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const columns = [
    { key: "orderNumber", header: "Order ID" },
    { key: "customerName", header: "Customer" },
    { key: "method", header: "Method", render: (p) => p.method.replaceAll("_", " ") },
    { key: "source", header: "Source", render: (p) => (p.source === "ONLINE" ? "Online" : "POS") },
    { key: "amountCents", header: "Amount", render: (p) => formatCentsAsCurrency(p.amountCents) },
    { key: "currency", header: "Currency" },
    {
      key: "status",
      header: "Status",
      render: (p) => <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>,
    },
    { key: "providerRef", header: "Stripe Ref", render: (p) => p.providerRef || "—" },
    { key: "recordedBy", header: "Recorded By" },
    { key: "createdAt", header: "Date", render: (p) => new Date(p.createdAt).toLocaleString() },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <button
          type="button"
          onClick={() => setSelectedId(p.id)}
          className="font-medium text-brand-red hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Payments" subtitle="Transactions, revenue breakdown, and reconciliation" />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <StatsGrid stats={stats} />

      <Card className="mb-4 flex flex-wrap items-center gap-4">
        <SelectFilter label="Method" value={method} onChange={setMethod} options={METHODS} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <SelectFilter label="Source" value={source} onChange={setSource} options={SOURCES} />
        <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
          Search
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Order # or email"
            className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </label>
      </Card>

      <DataTable columns={columns} rows={payments} emptyMessage="No payments recorded yet." />

      {selectedId && <PaymentDetailPanel paymentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <RequireAuth permission="reports:read">
      <PaymentsContent />
    </RequireAuth>
  );
}
