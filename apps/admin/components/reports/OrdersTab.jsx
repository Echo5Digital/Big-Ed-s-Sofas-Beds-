"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import { api, ApiClientError } from "@/lib/api/client";
import SalesTrendChart from "./SalesTrendChart";

export default function OrdersTab({ range, date, month, onError }) {
  const [breakdown, setBreakdown] = useState(null);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    const query = range === "month" ? `month=${month}` : `date=${date}`;
    api
      .get(`/reports/orders-breakdown?${query}`)
      .then(setBreakdown)
      .catch((err) => onError(err instanceof ApiClientError ? err.message : "Failed to load order report."));
  }, [range, date, month, onError]);

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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Booked" value={breakdown ? breakdown.booked : "—"} hint="Unallocated or reserved" />
        <StatCard label="Processing" value={breakdown ? breakdown.processing : "—"} hint="Online orders only" />
        <StatCard label="Ready" value={breakdown ? breakdown.ready : "—"} hint="Awaiting pickup/delivery" />
        <StatCard label="Complete" value={breakdown ? breakdown.complete : "—"} hint="Picked up or delivered" />
      </div>

      {breakdown && breakdown.canceled > 0 && (
        <p className="mb-6 text-sm text-brand-charcoal/50">
          {breakdown.canceled} order{breakdown.canceled === 1 ? "" : "s"} canceled in this range (excluded above).
        </p>
      )}

      <Card>
        <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Sales Trend</h2>
        <p className="mb-2 text-xs text-brand-charcoal/50">Last 30 days, all channels</p>
        <SalesTrendChart data={trend} />
      </Card>
    </div>
  );
}
