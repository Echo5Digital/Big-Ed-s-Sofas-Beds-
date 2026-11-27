"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";

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

function formatExpectedDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function AlertList({ rows, tone, emptyText }) {
  if (rows.length === 0) {
    return <p className="text-sm text-brand-charcoal/50">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-black/5">
      {rows.map((row) => (
        <li key={row.poLineId} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-medium text-brand-charcoal">
              {row.poNumber} — {row.supplierName}
            </p>
            <p className="font-mono text-xs text-brand-charcoal/45">{row.sku}</p>
          </div>
          <div className="shrink-0 text-right">
            <Badge tone={tone}>{formatExpectedDate(row.expectedDate)}</Badge>
            <p className="mt-0.5 text-xs text-brand-charcoal/50">{row.qtyOwed} still owed</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function POTab({ range, date, month, onError }) {
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    const query = range === "month" ? `month=${month}` : `date=${date}`;
    api
      .get(`/reports/overview?${query}`)
      .then(setOverview)
      .catch((err) => onError(err instanceof ApiClientError ? err.message : "Failed to load PO report."));
  }, [range, date, month, onError]);

  // Not range-scoped — "what needs attention right now", same as low stock.
  useEffect(() => {
    api
      .get("/reports/po-alerts")
      .then(setAlerts)
      .catch(() => setAlerts({ overdue: [], dueToday: [], dueSoon: [] }));
  }, []);

  return (
    <div>
      <Card className="mb-6">
        <h2 className="mb-1 font-display text-base font-bold text-brand-charcoal">Delivery Alerts</h2>
        <p className="mb-4 text-xs text-brand-charcoal/50">
          Open purchase order lines still owed, by how close the expected delivery date is.
        </p>
        {!alerts ? (
          <p className="text-sm text-brand-charcoal/50">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-red-700">Overdue ({alerts.overdue.length})</h3>
              <AlertList rows={alerts.overdue} tone="danger" emptyText="Nothing overdue." />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-amber-700">Due Today ({alerts.dueToday.length})</h3>
              <AlertList rows={alerts.dueToday} tone="warning" emptyText="Nothing due today." />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-blue-700">Due in 2 Days ({alerts.dueSoon.length})</h3>
              <AlertList rows={alerts.dueSoon} tone="info" emptyText="Nothing due soon." />
            </div>
          </div>
        )}
      </Card>

      <Card>
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
    </div>
  );
}
