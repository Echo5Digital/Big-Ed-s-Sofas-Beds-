"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";
import { useAuth } from "@/lib/hooks/useAuth";

const PO_STATUS_TONE = {
  DRAFT: "default",
  AWAITING_APPROVAL: "warning",
  APPROVED: "info",
  SENT_TO_VENDOR: "info",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELED: "danger",
};
const PO_STATUS_LABEL = {
  DRAFT: "Draft",
  AWAITING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  SENT_TO_VENDOR: "Sent to vendor",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CANCELED: "Canceled",
};

function todayDateInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function currentMonthInputValue() {
  return todayDateInputValue().slice(0, 7);
}

function formatTrendDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-brand-charcoal">{formatTrendDate(label)}</p>
      <p className="mt-1 text-brand-charcoal/70">
        Sales: <span className="font-semibold text-brand-charcoal">{formatCentsAsCurrency(point.salesCents)}</span>
      </p>
      <p className="text-brand-charcoal/70">
        Orders: <span className="font-semibold text-brand-charcoal">{point.orders}</span>
      </p>
    </div>
  );
}

// Same visual treatment as the dashboard's SalesTrendChart (apps/admin/app/page.jsx)
// so the two pages read as one system rather than two different chart styles.
function SalesTrendChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="py-16 text-center text-sm text-brand-charcoal/50">No sales data for this range yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="reportsSalesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b30813" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#b30813" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e1e0d9" />
        <XAxis
          dataKey="date"
          tickFormatter={formatTrendDate}
          tick={{ fontSize: 11, fill: "#898781" }}
          axisLine={{ stroke: "#c3c2b7" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatCentsAsCurrency(v).replace(/\.00$/, "")}
          tick={{ fontSize: 11, fill: "#898781" }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<TrendTooltip />} />
        <Area
          type="monotone"
          dataKey="salesCents"
          stroke="#b30813"
          strokeWidth={2}
          fill="url(#reportsSalesFill)"
          dot={{ r: 3, fill: "#b30813", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ReportsContent() {
  const { hasPermission } = useAuth();
  const canViewMargin = hasPermission("catalog:cost:view");
  const [range, setRange] = useState("day"); // "day" | "month"
  const [date, setDate] = useState(todayDateInputValue);
  const [month, setMonth] = useState(currentMonthInputValue);
  const [overview, setOverview] = useState(null);
  const [margin, setMargin] = useState(null);
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState(null);

  const loadOverview = useCallback((currentRange, selectedDate, selectedMonth) => {
    const query = currentRange === "month" ? `month=${selectedMonth}` : `date=${selectedDate}`;
    api
      .get(`/reports/overview?${query}`)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load report data."));
  }, []);

  useEffect(() => {
    loadOverview(range, date, month);
  }, [range, date, month, loadOverview]);

  // Separate from loadOverview above: a role without catalog:cost:view can
  // still use every other part of this page — margin is the one section
  // gated behind that extra permission, same as cost in the product form
  // and POS checkout, so it's fetched (and rendered) independently rather
  // than folded into the overview request every visitor makes.
  useEffect(() => {
    if (!canViewMargin) return;
    const query = range === "month" ? `month=${month}` : `date=${date}`;
    api
      .get(`/reports/margin?${query}`)
      .then(setMargin)
      .catch(() => setMargin(null));
  }, [canViewMargin, range, date, month]);

  // Trend chart always shows the last 30 days regardless of the day/month
  // toggle above — it's a rolling window for spotting direction at a glance,
  // not scoped to whichever single day/month is selected for the stat tiles.
  useEffect(() => {
    api
      .get("/reports/sales-trend?days=30")
      .then((data) => setTrend(data.days))
      .catch(() => setTrend([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Sales, purchasing, customers, and inventory health across the whole store"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-black/15 p-0.5 text-sm font-medium">
              <button
                type="button"
                onClick={() => setRange("day")}
                className={`rounded-md px-3 py-1 transition-colors ${
                  range === "day" ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-black/5"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setRange("month")}
                className={`rounded-md px-3 py-1 transition-colors ${
                  range === "month" ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-black/5"
                }`}
              >
                Month
              </button>
            </div>
            {range === "day" ? (
              <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
                Month
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </label>
            )}
          </div>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sales" value={overview ? formatCentsAsCurrency(overview.salesCents) : "—"} />
        <StatCard label="Orders" value={overview ? overview.orders : "—"} />
        <StatCard label="New Customers" value={overview ? overview.newCustomers : "—"} />
        <StatCard
          label="Purchasing Spend"
          value={overview ? formatCentsAsCurrency(overview.purchasingSpendCents) : "—"}
          hint="Committed cost of POs placed in range"
        />
      </div>

      {canViewMargin && (
        <Card className="mb-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-charcoal">Profit &amp; Margin</h2>
            <span className="text-xs font-medium text-brand-charcoal/40">
              Visible to Admin/Manager/Cashier only
            </span>
          </div>
          <p className="mb-4 text-xs text-brand-charcoal/50">
            Revenue vs. Purchase Price for this range. Uses each product&rsquo;s CURRENT Purchase Price, not what it
            cost at the time of an older sale — see the margin report&rsquo;s own notes for why.
          </p>

          {!margin ? (
            <p className="text-sm text-brand-charcoal/50">Loading…</p>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Revenue" value={formatCentsAsCurrency(margin.revenueCents)} />
                <StatCard label="Cost" value={formatCentsAsCurrency(margin.costCents)} />
                <StatCard
                  label="Margin"
                  value={`${formatCentsAsCurrency(margin.marginCents)} (${margin.marginPercent.toFixed(1)}%)`}
                />
              </div>

              {margin.unknownCostQuantity > 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {margin.unknownCostQuantity} unit{margin.unknownCostQuantity === 1 ? "" : "s"} sold in this range
                  {margin.unknownCostQuantity === 1 ? " has" : " have"} no Purchase Price on record and contributed
                  $0 cost above — actual margin for this range is likely lower than shown.
                </p>
              )}

              {margin.products.length === 0 ? (
                <p className="text-sm text-brand-charcoal/50">No sales in this range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
                        <th className="pb-2 pr-3">Product</th>
                        <th className="pb-2 pr-3">Qty</th>
                        <th className="pb-2 pr-3">Revenue</th>
                        <th className="pb-2 pr-3">Cost</th>
                        <th className="pb-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {margin.products.slice(0, 20).map((p) => (
                        <tr key={p.variantId}>
                          <td className="py-2 pr-3">
                            <p className="font-medium text-brand-charcoal">{p.name}</p>
                            <p className="font-mono text-xs text-brand-charcoal/45">{p.sku}</p>
                          </td>
                          <td className="py-2 pr-3 tabular-nums text-brand-charcoal/70">{p.quantity}</td>
                          <td className="py-2 pr-3 tabular-nums text-brand-charcoal">
                            {formatCentsAsCurrency(p.revenueCents)}
                          </td>
                          <td className="py-2 pr-3 tabular-nums text-brand-charcoal/70">
                            {formatCentsAsCurrency(p.costCents)}
                          </td>
                          <td
                            className={`py-2 tabular-nums font-semibold ${
                              p.marginCents < 0 ? "text-red-600" : "text-brand-charcoal"
                            }`}
                          >
                            {formatCentsAsCurrency(p.marginCents)} ({p.marginPercent.toFixed(1)}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {margin.products.length > 20 && (
                    <p className="mt-2 text-xs text-brand-charcoal/40">
                      Showing top 20 of {margin.products.length} products by margin.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Sales Trend</h2>
          <p className="mb-2 text-xs text-brand-charcoal/50">Last 30 days, all channels</p>
          <SalesTrendChart data={trend} />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-charcoal">Items Low on Stock</h2>
          </div>
          <p className="text-3xl font-bold text-brand-charcoal">{overview ? overview.lowStockCount : "—"}</p>
          <p className="text-xs text-brand-charcoal/50">Current snapshot, not range-scoped</p>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-4 font-display text-base font-bold text-brand-charcoal">Purchase Orders in Range</h2>
        {!overview || overview.purchaseOrdersByStatus.length === 0 ? (
          <p className="text-sm text-brand-charcoal/50">No purchase orders placed in this range.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/5">
            {overview.purchaseOrdersByStatus.map((row) => (
              <li key={row.status} className="flex items-center justify-between gap-3 py-2.5">
                <Badge tone={PO_STATUS_TONE[row.status] ?? "default"}>{PO_STATUS_LABEL[row.status] ?? row.status}</Badge>
                <span className="font-semibold text-brand-charcoal">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="text-sm text-brand-charcoal/60">
        Sales and order totals above already include in-store POS sales (cash and deposit tender) alongside online
        orders. Payment-method breakdowns, deposits, refunds, and outstanding balances now live on the{" "}
        <a href="/payments" className="font-medium text-brand-red hover:underline">
          Payments
        </a>{" "}
        page. Register open/close history and cash reconciliation live on the{" "}
        <a href="/registers" className="font-medium text-brand-red hover:underline">
          Registers
        </a>{" "}
        page.
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth permission="reports:read">
      <ReportsContent />
    </RequireAuth>
  );
}
