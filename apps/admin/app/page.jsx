"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PlusCircle, PackageCheck, ClipboardPlus } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

function DashboardContent() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/dashboard/overview")
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard data."));
  }, []);

  return (
    <div>
      <PageHeader title="Store Overview" subtitle="Today — One showroom + warehouse" />

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Sales Today"
          value={overview ? formatCentsAsCurrency(overview.salesTodayCents) : "—"}
        />
        <StatCard label="Orders" value={overview ? overview.ordersToday : "—"} />
        <StatCard label="Low Stock" value={overview ? overview.lowStockCount : "—"} />
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
        </div>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
