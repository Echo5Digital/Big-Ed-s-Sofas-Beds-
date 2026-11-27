"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const ROLE_LABEL = { SALESMAN: "Salesman", MANAGER: "Manager" };
const ROLE_TONE = { SALESMAN: "info", MANAGER: "gold" };

export default function PerformanceTab({ range, date, month, onError }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const query = range === "month" ? `month=${month}` : `date=${date}`;
    api
      .get(`/reports/performance?${query}`)
      .then(setData)
      .catch((err) => onError(err instanceof ApiClientError ? err.message : "Failed to load performance report."));
  }, [range, date, month, onError]);

  return (
    <Card>
      <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Sales Leaderboard</h2>
      <p className="mb-4 text-xs text-brand-charcoal/50">
        Ranked by revenue attributed to each salesperson/manager in this range (split credit for shared sales).
      </p>

      {!data ? (
        <p className="text-sm text-brand-charcoal/50">Loading…</p>
      ) : data.staff.length === 0 ? (
        <p className="text-sm text-brand-charcoal/50">No attributed sales in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-100 text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
                <th className="pb-2 pr-3">Rank</th>
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Role</th>
                <th className="pb-2 pr-3">Sales</th>
                <th className="pb-2">Attributed Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data.staff.map((entry) => (
                <tr key={entry.userId} className={entry.rank === 1 ? "bg-brand-gold/10" : undefined}>
                  <td className="py-2.5 pr-3 font-bold text-brand-charcoal">
                    {entry.rank === 1 ? "🏆 1" : `#${entry.rank}`}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-brand-charcoal">{entry.name}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={ROLE_TONE[entry.role] ?? "default"}>{ROLE_LABEL[entry.role] ?? entry.role}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-brand-charcoal/70">{entry.saleCount}</td>
                  <td className="py-2.5 tabular-nums font-semibold text-brand-charcoal">
                    {formatCentsAsCurrency(entry.attributedRevenueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
