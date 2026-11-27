"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Undo2, Truck, MonitorSmartphone } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { api } from "@/lib/api/client";

// How often to check for newly-stuck registers/PO alerts/return requests
// while an admin/manager is in the dashboard. Short enough that something
// needing attention surfaces promptly; polling rather than push since this
// codebase has no websocket/SSE infrastructure yet.
const POLL_MS = 20000;

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatExpectedDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const { hasPermission } = useAuth();
  const canApproveReopen = hasPermission("pos:register:approve-reopen");
  // /reports/po-alerts is gated on reports:view (Reports-page-only, admin/
  // super admin), not the broader reports:read — see reports.routes.js.
  const canReadReports = hasPermission("reports:view");
  const canReadMessages = hasPermission("messages:read");

  const [reopenSessions, setReopenSessions] = useState([]);
  const [poAlerts, setPoAlerts] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const load = useCallback(() => {
    if (canApproveReopen) {
      api
        .get("/pos/registers/pending-reopens")
        .then((data) => setReopenSessions(data.sessions))
        .catch(() => {
          // Silent — this is a background badge, not a page the admin is
          // actively waiting on; the Registers page surfaces load errors itself.
        });
    }
    if (canReadReports) {
      api
        .get("/reports/po-alerts")
        .then((data) => setPoAlerts([...data.overdue, ...data.dueToday, ...data.dueSoon]))
        .catch(() => {
          // Silent — same reasoning as above.
        });
    }
    if (canReadMessages) {
      api
        .get("/messages/return-requests")
        .then((data) => setReturnRequests(data.messages))
        .catch(() => {
          // Silent — same reasoning as above.
        });
    }
  }, [canApproveReopen, canReadReports, canReadMessages]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleLinkClick() {
    setOpen(false);
  }

  const totalCount = reopenSessions.length + poAlerts.length + returnRequests.length;
  const hasAnyNotifications = reopenSessions.length > 0 || poAlerts.length > 0 || returnRequests.length > 0;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${totalCount > 0 ? ` (${totalCount} pending)` : ""}`}
        className="relative rounded-full p-2 text-brand-charcoal hover:bg-black/5"
      >
        <Bell className="size-5" aria-hidden="true" />
        {totalCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-xl border border-black/10 bg-white text-brand-charcoal shadow-xl">
          <div className="border-b border-black/10 px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!hasAnyNotifications ? (
              <p className="px-4 py-6 text-center text-sm text-brand-charcoal/50">Nothing needs your attention.</p>
            ) : (
              <ul>
                {reopenSessions.map((session) => (
                  <li key={`reopen-${session.id}`} className="flex gap-2.5 border-b border-black/5 px-4 py-3 last:border-0">
                    <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Register reopen needs approval</p>
                      <p className="truncate text-xs text-brand-charcoal/60">
                        {session.registerName}
                        {session.locationName ? ` — ${session.locationName}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-charcoal/40">
                        {session.reopenRequestedByName ? `${session.reopenRequestedByName} · ` : ""}
                        {session.reopenRequestedAt ? timeAgo(session.reopenRequestedAt) : ""}
                      </p>
                    </div>
                  </li>
                ))}
                {poAlerts.map((alert) => (
                  <li key={`po-${alert.poLineId}`} className="flex gap-2.5 border-b border-black/5 px-4 py-3 last:border-0">
                    <Truck className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">PO delivery due {formatExpectedDate(alert.expectedDate)}</p>
                      <p className="truncate text-xs text-brand-charcoal/60">
                        {alert.poNumber} — {alert.supplierName}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-charcoal/40">{alert.qtyOwed} units still owed</p>
                    </div>
                  </li>
                ))}
                {returnRequests.map((message) => (
                  <li key={`return-${message.id}`} className="flex gap-2.5 border-b border-black/5 px-4 py-3 last:border-0">
                    <Undo2 className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Return request</p>
                      <p className="truncate text-xs text-brand-charcoal/60">
                        {message.name}
                        {message.returnOrderReference ? ` — Order ${message.returnOrderReference}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-charcoal/40">{timeAgo(message.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex divide-x divide-black/10 border-t border-black/10">
            {canApproveReopen && (
              <Link
                href="/registers"
                onClick={handleLinkClick}
                className="flex-1 px-4 py-2.5 text-center text-sm font-semibold text-brand-red hover:bg-brand-cream/40"
              >
                Registers
              </Link>
            )}
            {canReadReports && (
              <Link
                href="/reports"
                onClick={handleLinkClick}
                className="flex-1 px-4 py-2.5 text-center text-sm font-semibold text-brand-red hover:bg-brand-cream/40"
              >
                Reports
              </Link>
            )}
            {canReadMessages && (
              <Link
                href="/messages"
                onClick={handleLinkClick}
                className="flex-1 px-4 py-2.5 text-center text-sm font-semibold text-brand-red hover:bg-brand-cream/40"
              >
                Messages
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
