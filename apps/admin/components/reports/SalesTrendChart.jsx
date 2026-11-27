"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

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
export default function SalesTrendChart({ data }) {
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
