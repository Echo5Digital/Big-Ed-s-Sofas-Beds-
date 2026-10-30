"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  PlusCircle,
  PackageCheck,
  ClipboardPlus,
  DollarSign,
  ShoppingCart,
  Boxes,
  Package,
  LayoutGrid,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

// Drawn from this app's own brand palette (apps/admin/app/globals.css) —
// gold for the common "in progress" state, red for canceled (matches the
// danger badge elsewhere), navy and a neutral gray round out the set —
// rather than a generic chart-library default that wouldn't read as part
// of this app.
const ORDER_STATUS_COLOR = {
  DRAFT: "#9ca3af",
  CONFIRMED: "#f7bf32",
  CANCELED: "#b30813",
  CLOSED: "#111827",
};
const ORDER_STATUS_BADGE_TONE = { DRAFT: "default", CONFIRMED: "info", CANCELED: "danger", CLOSED: "success" };

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

function SalesTrendChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="py-16 text-center text-sm text-brand-charcoal/50">No sales data yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
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
          fill="url(#salesFill)"
          dot={{ r: 3, fill: "#b30813", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function OrdersByStatusChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return <p className="py-16 text-center text-sm text-brand-charcoal/50">No orders yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          strokeWidth={2}
          stroke="#fff"
        >
          {data.map((entry) => (
            <Cell key={entry.status} fill={ORDER_STATUS_COLOR[entry.status] ?? "#898781"} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} order${value === 1 ? "" : "s"}`, name]}
          contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 12 }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs text-brand-charcoal/70">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function DashboardContent({ overview, trend, error }) {
  const orderColumns = [
    { key: "orderNumber", header: "Order", render: (r) => <span className="font-semibold">{r.orderNumber}</span> },
    { key: "customerName", header: "Customer" },
    { key: "channel", header: "Channel", render: (r) => <Badge tone={r.channel === "POS" ? "gold" : "info"}>{r.channel}</Badge> },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={ORDER_STATUS_BADGE_TONE[r.status] ?? "default"}>{r.status}</Badge>,
    },
    { key: "totalCents", header: "Total", render: (r) => formatCentsAsCurrency(r.totalCents) },
    {
      key: "createdAt",
      header: "Placed",
      render: (r) => new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    },
  ];

  return (
    <div>
      <PageHeader title="Store Overview" subtitle="Today — One showroom + warehouse" />

      {error && <Card className="mb-6 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Sales Today"
          value={overview ? formatCentsAsCurrency(overview.salesTodayCents) : "—"}
          icon={DollarSign}
          tone="red"
        />
        <StatCard label="Orders Today" value={overview ? overview.ordersToday : "—"} icon={ShoppingCart} tone="gold" />
        <StatCard
          label="Cash Sales Today"
          value={overview ? formatCentsAsCurrency(overview.registerActivityToday.cashSalesTodayCents) : "—"}
          hint={overview ? `${overview.registerActivityToday.closedCount} register(s) closed` : undefined}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Low Stock"
          value={overview ? overview.lowStockCount : "—"}
          icon={AlertTriangle}
          tone={overview?.lowStockCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Active Products"
          value={overview ? overview.catalog.activeProducts : "—"}
          icon={Package}
          tone="default"
        />
        <StatCard
          label="Categories"
          value={overview ? overview.catalog.categories : "—"}
          icon={LayoutGrid}
          tone="default"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
        <Card className="flex flex-col lg:col-span-2">
          <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Sales Trend</h2>
          <p className="mb-2 text-xs text-brand-charcoal/50">Last 14 days, all channels</p>
          <div className="flex-1">
            <SalesTrendChart data={trend} />
          </div>
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Orders by Status</h2>
          <p className="mb-2 text-xs text-brand-charcoal/50">All-time</p>
          <div className="flex flex-1 items-center justify-center">
            <OrdersByStatusChart data={overview?.ordersByStatus ?? []} />
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-brand-charcoal">
          <AlertTriangle className="size-4.5 text-amber-500" aria-hidden="true" />
          Requires Attention
        </h2>

        {overview && overview.lowStock.length === 0 ? (
          <p className="text-sm text-brand-charcoal/50">No low-stock items right now.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/5">
            {overview?.lowStock.map((item) => (
              <li key={`${item.sku}-${item.locationName}`} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-charcoal">
                    {item.productName} — {item.variantName}
                  </p>
                  <p className="text-xs text-brand-charcoal/50">
                    SKU {item.sku} • {item.availableToSell} available at {item.locationName}
                  </p>
                </div>
                <Badge tone={item.availableToSell === 0 ? "danger" : "warning"}>
                  {item.availableToSell === 0 ? "OUT OF STOCK" : "REORDER"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-brand-charcoal">Recent Orders</h2>
          <Link href="/orders" className="text-sm font-semibold text-brand-red hover:underline">
            View all
          </Link>
        </div>
        <DataTable columns={orderColumns} rows={overview?.recentOrders ?? []} emptyMessage="No orders yet." />
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-charcoal">Purchasing Pipeline</h2>
            <Link href="/purchasing" className="text-sm font-semibold text-brand-red hover:underline">
              View all
            </Link>
          </div>
          {!overview || overview.purchaseOrdersByStatus.length === 0 ? (
            <p className="text-sm text-brand-charcoal/50">No purchase orders yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-black/5">
              {overview.purchaseOrdersByStatus.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-3 py-2.5">
                  <Badge tone={PO_STATUS_TONE[row.status] ?? "default"}>
                    {PO_STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                  <span className="font-semibold text-brand-charcoal">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-base font-bold text-brand-charcoal">Register Activity Today</h2>
          {overview ? (
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-brand-charcoal/60">Open now</dt>
              <dd className="text-right font-semibold text-brand-charcoal">{overview.registerActivityToday.openCount}</dd>
              <dt className="text-brand-charcoal/60">Closed today</dt>
              <dd className="text-right font-semibold text-brand-charcoal">{overview.registerActivityToday.closedCount}</dd>
              <dt className="text-brand-charcoal/60">Pending approval</dt>
              <dd className="text-right font-semibold text-brand-charcoal">
                {overview.registerActivityToday.pendingApprovalCount > 0 ? (
                  <Badge tone="warning">{overview.registerActivityToday.pendingApprovalCount}</Badge>
                ) : (
                  0
                )}
              </dd>
              <dt className="mt-1 border-t border-black/10 pt-3 font-medium text-brand-charcoal/70">Cash sales</dt>
              <dd className="mt-1 border-t border-black/10 pt-3 text-right font-bold text-brand-charcoal">
                {formatCentsAsCurrency(overview.registerActivityToday.cashSalesTodayCents)}
              </dd>
            </dl>
          ) : (
            <p className="text-sm text-brand-charcoal/50">Loading…</p>
          )}
          {overview?.registerActivityToday.pendingApprovalCount > 0 && (
            <Link
              href="/registers"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red hover:underline"
            >
              Review pending registers
            </Link>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-display text-base font-bold text-brand-charcoal">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products/new"
            className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
          >
            <PlusCircle className="size-4" aria-hidden="true" />
            New Product
          </Link>
          <Link
            href="/purchasing/new"
            className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-charcoal hover:bg-brand-gold-dark"
          >
            <ClipboardPlus className="size-4" aria-hidden="true" />
            New Purchase Order
          </Link>
          <Link
            href="/purchasing"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-brand-charcoal hover:bg-gray-50"
          >
            <PackageCheck className="size-4" aria-hidden="true" />
            Receive Stock
          </Link>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-brand-charcoal hover:bg-gray-50"
          >
            <Boxes className="size-4" aria-hidden="true" />
            Inventory
          </Link>
        </div>
      </Card>
    </div>
  );
}

// Fetches dashboard data here, in the page's top-level component, which
// mounts the instant this route loads — rather than inside DashboardContent,
// which RequireAuth doesn't render until its own /auth/me check resolves.
// That gate is correct for permission-gated UI (don't show the page shell to
// someone who turns out to be unauthorized) but there's no reason the data
// FETCH has to wait on it too: the API independently re-verifies auth and
// the reports:read permission on every request regardless of what the
// client has already fetched, so starting these two calls immediately,
// concurrently with /auth/me instead of strictly after it, removes a full
// extra network round-trip of pure waiting before the dashboard can start
// loading — with no change to who can see page content.
export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/dashboard/overview"), api.get("/reports/sales-trend?days=14")])
      .then(([overviewData, trendData]) => {
        setOverview(overviewData);
        setTrend(trendData.days);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard data."));
  }, []);

  return (
    <RequireAuth permission="reports:read">
      <DashboardContent overview={overview} trend={trend} error={error} />
    </RequireAuth>
  );
}
