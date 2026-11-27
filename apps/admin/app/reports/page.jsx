"use client";

import { useCallback, useState } from "react";
import RequireAuth from "@/components/layout/RequireAuth";
import ReportsTabs from "@/components/reports/ReportsTabs";
import ReportsAlertsStrip from "@/components/reports/ReportsAlertsStrip";
import PaymentsTab from "@/components/reports/PaymentsTab";
import ProductsTab from "@/components/reports/ProductsTab";
import OrdersTab from "@/components/reports/OrdersTab";
import POTab from "@/components/reports/POTab";
import PerformanceTab from "@/components/reports/PerformanceTab";

const TABS = [
  { key: "payments", label: "Payments" },
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "po", label: "PO" },
  { key: "performance", label: "Performance" },
];

function todayDateInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function currentMonthInputValue() {
  return todayDateInputValue().slice(0, 7);
}

function ReportsContent() {
  const [activeTab, setActiveTab] = useState("payments");
  const [range, setRange] = useState("day"); // "day" | "month"
  const [date, setDate] = useState(todayDateInputValue);
  const [month, setMonth] = useState(currentMonthInputValue);
  const [error, setError] = useState(null);

  const handleError = useCallback((message) => setError(message), []);

  const sharedTabProps = { range, date, month, onError: handleError };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-xl font-bold text-brand-charcoal sm:text-2xl">Reports</h1>
        <p className="text-sm text-brand-charcoal/60">
          Sales, purchasing, customers, and inventory health across the whole store
        </p>
      </div>

      <ReportsAlertsStrip onJumpToTab={setActiveTab} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ReportsTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-black/15 p-0.5 text-sm font-medium">
            <button
              type="button"
              onClick={() => setRange("day")}
              className={`rounded-md px-3 py-1 transition-colors ${
                range === "day" ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-black/5"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setRange("month")}
              className={`rounded-md px-3 py-1 transition-colors ${
                range === "month" ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-black/5"
              }`}
            >
              Month
            </button>
          </div>
          {range === "day" ? (
            <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {activeTab === "payments" && <PaymentsTab {...sharedTabProps} />}
      {activeTab === "products" && <ProductsTab {...sharedTabProps} />}
      {activeTab === "orders" && <OrdersTab {...sharedTabProps} />}
      {activeTab === "po" && <POTab {...sharedTabProps} />}
      {activeTab === "performance" && <PerformanceTab {...sharedTabProps} />}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth permission="reports:view">
      <ReportsContent />
    </RequireAuth>
  );
}
