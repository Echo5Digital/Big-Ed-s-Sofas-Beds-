"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/Card";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

function todayDateInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const MOVEMENT_LABELS = {
  SALE: "Sales",
  REFUND: "Refunds",
  PAID_IN: "Paid in",
  PAID_OUT: "Paid out",
  DEPOSIT: "Deposits",
};

function DiscrepancyBadge({ cents }) {
  if (cents === null || cents === undefined) return <span className="text-brand-charcoal/40">—</span>;
  if (cents === 0) return <Badge tone="success">Balanced</Badge>;
  const over = cents > 0;
  return (
    <Badge tone={over ? "info" : "danger"}>
      {over ? "Over" : "Short"} {formatCentsAsCurrency(Math.abs(cents))}
    </Badge>
  );
}

function RegisterSessionRow({ session }) {
  const [expanded, setExpanded] = useState(false);
  const netMovementCents = Object.entries(session.movementTotals).reduce((sum, [type, amount]) => {
    const sign = type === "REFUND" || type === "PAID_OUT" ? -1 : 1;
    return sum + sign * amount;
  }, 0);

  return (
    <div className="rounded-xl border border-black/10 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 sm:gap-6"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-brand-charcoal/50" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-brand-charcoal/50" aria-hidden="true" />
        )}

        <div className="min-w-35">
          <div className="text-sm font-semibold text-brand-charcoal">{session.registerName}</div>
          <div className="text-xs text-brand-charcoal/50">{session.locationName}</div>
        </div>

        <div className="min-w-40 text-sm">
          <div className="text-brand-charcoal/70">Opened {formatDateTime(session.openedAt)}</div>
          <div className="text-brand-charcoal/50">
            {session.status === "CLOSED" ? `Closed ${formatDateTime(session.closedAt)}` : "Still open"}
          </div>
        </div>

        <div className="text-sm text-brand-charcoal/70">by {session.openedByName}</div>

        <Badge tone={session.status === "OPEN" ? "warning" : "default"}>{session.status}</Badge>

        <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
          <div>
            <div className="text-xs text-brand-charcoal/50">Opening</div>
            <div className="font-medium text-brand-charcoal">{formatCentsAsCurrency(session.openingCashCents)}</div>
          </div>
          <div>
            <div className="text-xs text-brand-charcoal/50">Net cash</div>
            <div className="font-medium text-brand-charcoal">{formatCentsAsCurrency(netMovementCents)}</div>
          </div>
          <div>
            <div className="text-xs text-brand-charcoal/50">Closing</div>
            <div className="font-medium text-brand-charcoal">
              {session.status === "CLOSED" ? formatCentsAsCurrency(session.closingCashCents) : "—"}
            </div>
          </div>
          <DiscrepancyBadge cents={session.discrepancyCents} />
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-black/10 p-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
              Cash in / out
            </h3>
            {session.cashMovements.length === 0 ? (
              <p className="text-sm text-brand-charcoal/40">No cash movements recorded.</p>
            ) : (
              <ul className="space-y-1.5">
                {session.cashMovements.map((m) => {
                  const isOut = m.type === "REFUND" || m.type === "PAID_OUT";
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-brand-charcoal/70">
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                        {m.notes ? ` — ${m.notes}` : ""}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={isOut ? "text-red-600" : "text-green-700"}>
                          {isOut ? "-" : "+"}
                          {formatCentsAsCurrency(m.amountCents)}
                        </span>
                        <span className="ml-2 text-xs text-brand-charcoal/40">{formatDateTime(m.createdAt)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
              Items sold
            </h3>
            {session.sales.length === 0 ? (
              <p className="text-sm text-brand-charcoal/40">No sales rung up during this session.</p>
            ) : (
              <ul className="space-y-1.5">
                {session.sales.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-brand-charcoal/70">
                      {s.orderNumber} · {s.itemCount} item{s.itemCount === 1 ? "" : "s"}
                      {s.tenderMethod ? ` · ${s.tenderMethod.toLowerCase()}` : ""}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-medium text-brand-charcoal">{formatCentsAsCurrency(s.totalCents)}</span>
                      <span className="ml-2 text-xs text-brand-charcoal/40">{formatDateTime(s.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsContent() {
  const [date, setDate] = useState(todayDateInputValue);
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  const loadOverview = useCallback((selectedDate) => {
    api
      .get(`/reports/overview?date=${selectedDate}`)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load report data."));
  }, []);

  const loadSessions = useCallback(() => {
    api
      .get("/reports/register-sessions")
      .then((data) => setSessions(data.sessions))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load register sessions."));
  }, []);

  useEffect(() => {
    loadOverview(date);
  }, [date, loadOverview]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

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

      <Card className="mb-6 text-sm text-brand-charcoal/60">
        Sales and order totals above already include in-store POS sales (cash and deposit tender) alongside online
        orders. Deeper financial reporting (cost-of-goods, margin by category) and card-tender settlement reports are
        planned once a payment provider is integrated — see <code>docs/requirements/open-questions.md</code>.
      </Card>

      <h2 className="mb-3 font-display text-base font-bold text-brand-charcoal">Register sessions</h2>
      <p className="mb-3 text-sm text-brand-charcoal/60">
        Every register open/close, including past sessions, with cash movements and items sold. Click a row to expand.
      </p>

      {sessions === null ? (
        <p className="text-sm text-brand-charcoal/50">Loading register sessions…</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-brand-charcoal/50">
          No register sessions recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <RegisterSessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
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
