"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

function ReportsContent() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/dashboard/overview")
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load report data."));
  }, []);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Daily sales and inventory health" />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sales Today" value={overview ? formatCentsAsCurrency(overview.salesTodayCents) : "—"} />
        <StatCard label="Orders Today" value={overview ? overview.ordersToday : "—"} />
        <StatCard label="Items Low on Stock" value={overview ? overview.lowStockCount : "—"} />
      </div>

      <Card className="text-sm text-brand-charcoal/60">
        Sales and order totals above already include in-store POS sales (cash and deposit tender) alongside online
        orders. Deeper financial reporting (cost-of-goods, margin by category) and card-tender settlement reports are
        planned once a payment provider is integrated — see <code>docs/requirements/open-questions.md</code>.
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
