"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";
import { useAuth } from "@/lib/hooks/useAuth";

export default function PaymentsTab({ range, date, month, onError }) {
  const { hasPermission } = useAuth();
  const canViewMargin = hasPermission("catalog:cost:view");
  const [overview, setOverview] = useState(null);
  const [margin, setMargin] = useState(null);

  useEffect(() => {
    const query = range === "month" ? `month=${month}` : `date=${date}`;
    api
      .get(`/reports/overview?${query}`)
      .then(setOverview)
      .catch((err) => onError(err instanceof ApiClientError ? err.message : "Failed to load report data."));
  }, [range, date, month, onError]);

  // Separate from overview above: a role without catalog:cost:view can still
  // use every other part of this page — margin is the one section gated
  // behind that extra permission, same as cost in the product form and POS
  // checkout, so it's fetched (and rendered) independently rather than
  // folded into the overview request every visitor makes.
  useEffect(() => {
    if (!canViewMargin) return;
    const query = range === "month" ? `month=${month}` : `date=${date}`;
    api
      .get(`/reports/margin?${query}`)
      .then(setMargin)
      .catch(() => setMargin(null));
  }, [canViewMargin, range, date, month]);

  return (
    <div>
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
                  <table className="w-full min-w-120 text-sm">
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

      <Card className="text-sm text-brand-charcoal/60">
        Sales and order totals above already include in-store POS sales (cash and deposit tender) alongside online
        orders. Payment-method breakdowns, deposits, refunds, and outstanding balances live on the{" "}
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
