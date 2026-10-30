"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api } from "@/lib/api/client";

// How often to check for newly-stuck registers while an admin/manager is in
// the dashboard. Short enough that a stuck register surfaces promptly;
// polling rather than push since this codebase has no websocket/SSE
// infrastructure yet.
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

export default function NotificationBell({ onNavigate }) {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const load = useCallback(() => {
    api
      .get("/pos/registers/pending-reopens")
      .then((data) => setSessions(data.sessions))
      .catch(() => {
        // Silent — this is a background badge, not a page the admin is
        // actively waiting on; the Registers page surfaces load errors itself.
      });
  }, []);

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
    onNavigate?.();
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${sessions.length > 0 ? ` (${sessions.length} pending)` : ""}`}
        className="relative rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white lg:text-brand-charcoal lg:hover:bg-black/5 lg:hover:text-brand-charcoal"
      >
        <Bell className="size-5" aria-hidden="true" />
        {sessions.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
            {sessions.length > 9 ? "9+" : sessions.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-xl border border-black/10 bg-white text-brand-charcoal shadow-xl">
          <div className="border-b border-black/10 px-4 py-3">
            <p className="text-sm font-bold">Register approvals</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-brand-charcoal/50">Nothing needs your approval.</p>
            ) : (
              <ul>
                {sessions.map((session) => (
                  <li key={session.id} className="border-b border-black/5 px-4 py-3 last:border-0">
                    <p className="text-sm font-semibold">Register reopen needs approval</p>
                    <p className="truncate text-xs text-brand-charcoal/60">
                      {session.registerName}
                      {session.locationName ? ` — ${session.locationName}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-charcoal/40">
                      {session.reopenRequestedByName ? `${session.reopenRequestedByName} · ` : ""}
                      {session.reopenRequestedAt ? timeAgo(session.reopenRequestedAt) : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/registers"
            onClick={handleLinkClick}
            className="block border-t border-black/10 px-4 py-2.5 text-center text-sm font-semibold text-brand-red hover:bg-brand-cream/40"
          >
            Review registers
          </Link>
        </div>
      )}
    </div>
  );
}
