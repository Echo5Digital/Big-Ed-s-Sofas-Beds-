"use client";

import { useCallback, useEffect, useState } from "react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

function todayDateInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function ReportsContent() {
  const [date, setDate] = useState(todayDateInputValue);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  const loadOverview = useCallback((selectedDate) => {
    api
      .get(`/reports/overview?date=${selectedDate}`)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load report data."));
  }, []);

  useEffect(() => {
    loadOverview(date);
  }, [date, loadOverview]);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Daily sales, inventory health, and register activity"
        action={
          <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </label>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sales" value={overview ? formatCentsAsCurrency(overview.salesCents) : "—"} />
        <StatCard label="Orders" value={overview ? overview.orders : "—"} />
        <StatCard label="Items Low on Stock" value={overview ? overview.lowStockCount : "—"} hint="Current snapshot" />
      </div>

      <Card className="text-sm text-brand-charcoal/60">
        Sales and order totals above already include in-store POS sales (cash and deposit tender) alongside online
        orders. Deeper financial reporting (cost-of-goods, margin by category) and card-tender settlement reports are
        planned once a payment provider is integrated — see <code>docs/requirements/open-questions.md</code>. Register
        open/close history and cash reconciliation now live on the{" "}
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
