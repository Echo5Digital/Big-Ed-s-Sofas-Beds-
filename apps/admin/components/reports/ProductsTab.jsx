"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

export default function ProductsTab({ range, date, month, onError }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const query = range === "month" ? `month=${month}` : `date=${date}`;
    api
      .get(`/reports/products?${query}`)
      .then(setData)
      .catch((err) => onError(err instanceof ApiClientError ? err.message : "Failed to load product report."));
  }, [range, date, month, onError]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={data ? data.totalProducts : "—"} />
        <StatCard label="Variants (SKUs)" value={data ? data.totalVariants : "—"} />
        <StatCard
          label="Items Low on Stock"
          value={data ? data.lowStockCount : "—"}
          hint="Current snapshot, not range-scoped"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Most Sold</h2>
          <p className="mb-3 text-xs text-brand-charcoal/50">By quantity sold in this range</p>
          {!data ? (
            <p className="text-sm text-brand-charcoal/50">Loading…</p>
          ) : data.mostSold.length === 0 ? (
            <p className="text-sm text-brand-charcoal/50">No sales in this range.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-black/5">
              {data.mostSold.map((p) => (
                <li key={p.variantId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-brand-charcoal">{p.name}</p>
                    <p className="font-mono text-xs text-brand-charcoal/45">{p.sku}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-brand-charcoal">{p.quantity} sold</p>
                    <p className="text-xs text-brand-charcoal/50">{formatCentsAsCurrency(p.revenueCents)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Most Reviewed</h2>
          <p className="mb-3 text-xs text-brand-charcoal/50">All-time review volume</p>
          {!data ? (
            <p className="text-sm text-brand-charcoal/50">Loading…</p>
          ) : data.mostReviewed.length === 0 ? (
            <p className="text-sm text-brand-charcoal/50">No reviews yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-black/5">
              {data.mostReviewed.map((p) => (
                <li key={p.productId} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="min-w-0 truncate font-medium text-brand-charcoal">{p.name}</p>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-brand-charcoal">{p.reviewCount} reviews</p>
                    <p className="text-xs text-brand-charcoal/50">{p.averageRating.toFixed(1)}★ avg</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
