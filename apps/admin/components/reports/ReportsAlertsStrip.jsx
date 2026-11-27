"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Truck, Undo2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { api } from "@/lib/api/client";

const POLL_MS = 60000;

function AlertTile({ icon: Icon, label, count, tone, href, onClick }) {
  const toneClasses =
    count > 0
      ? { red: "border-red-200 bg-red-50 text-red-700", amber: "border-amber-200 bg-amber-50 text-amber-800" }[tone]
      : "border-black/10 bg-white text-brand-charcoal/60";
  const Wrapper = href ? Link : "button";
  const wrapperProps = href ? { href } : { type: "button", onClick };

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:brightness-95 ${toneClasses}`}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{count}</p>
        <p className="truncate text-xs font-medium">{label}</p>
      </div>
    </Wrapper>
  );
}

// At-a-glance "what needs attention" strip sitting above the tabs, visible
// regardless of which tab is active — reuses data each tab already fetches
// independently (low stock, PO alerts, return requests) so this is close to
// free, and saves staff from clicking into every tab just to discover a
// problem exists.
export default function ReportsAlertsStrip({ onJumpToTab }) {
  const { hasPermission } = useAuth();
  const canReadMessages = hasPermission("messages:read");
  const [lowStockCount, setLowStockCount] = useState(0);
  const [poAlertCount, setPoAlertCount] = useState(0);
  const [returnRequestCount, setReturnRequestCount] = useState(0);

  useEffect(() => {
    function load() {
      api
        .get("/reports/po-alerts")
        .then((data) => setPoAlertCount(data.overdue.length + data.dueToday.length + data.dueSoon.length))
        .catch(() => {});
      api
        .get("/reports/overview")
        .then((data) => setLowStockCount(data.lowStockCount))
        .catch(() => {});
      if (canReadMessages) {
        api
          .get("/messages/counts")
          .then((data) => setReturnRequestCount(data.returnRequests))
          .catch(() => {});
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [canReadMessages]);

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      <AlertTile
        icon={AlertTriangle}
        label="Items Low on Stock"
        count={lowStockCount}
        tone="amber"
        onClick={() => onJumpToTab("products")}
      />
      <AlertTile
        icon={Truck}
        label="PO Deliveries Due/Overdue"
        count={poAlertCount}
        tone="red"
        onClick={() => onJumpToTab("po")}
      />
      {canReadMessages && (
        <AlertTile icon={Undo2} label="Pending Return Requests" count={returnRequestCount} tone="red" href="/messages" />
      )}
    </div>
  );
}
