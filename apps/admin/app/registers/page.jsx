"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

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

function ApproveModal({ session, onClose, onDone }) {
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const closingCashCents = Math.round(Number(closingCash || 0) * 100);
      await api.post(`/pos/sessions/${session.id}/approve-reopen`, { closingCashCents, notes: notes || null });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to approve reopen request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Approve reopen — ${session.registerName}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-brand-charcoal/60">
          Count this register&apos;s drawer and enter the total to close out the stuck session. We&apos;ll compare it
          against recorded cash sales, deposits, and refunds for this session, same as a normal close.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="approveClosingCash" className="text-sm font-medium text-brand-charcoal">
            Counted cash ($)
          </label>
          <input
            id="approveClosingCash"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            required
            value={closingCash}
            onChange={(e) => setClosingCash(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2.5 text-base focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="approveNotes" className="text-sm font-medium text-brand-charcoal">
            Notes (optional)
          </label>
          <textarea
            id="approveNotes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Approving…" : "Approve & close register"}
        </Button>
      </form>
    </Modal>
  );
}

function DenyModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/pos/sessions/${session.id}/deny-reopen`, { reason: reason || null });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to deny reopen request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Deny reopen — ${session.registerName}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-brand-charcoal/60">
          The register stays locked and the session stays open. Use this when the drawer needs to be checked in
          person before it can be reconciled.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="denyReason" className="text-sm font-medium text-brand-charcoal">
            Reason (optional)
          </label>
          <textarea
            id="denyReason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" variant="outline" disabled={submitting} className="w-full">
          {submitting ? "Denying…" : "Deny request"}
        </Button>
      </form>
    </Modal>
  );
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function RegistersContent() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(null);
  const [denying, setDenying] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);

  const load = useCallback(() => {
    return api
      .get("/pos/registers/pending-reopens")
      .then((data) => setSessions(data.sessions))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load pending reopen requests."))
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = useCallback(() => {
    return api
      .get("/reports/register-sessions")
      .then((data) => setHistory(data.sessions))
      .catch((err) =>
        setHistoryError(err instanceof ApiClientError ? err.message : "Failed to load register session history.")
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function handleDone() {
    setApproving(null);
    setDenying(null);
    load();
    loadHistory();
  }

  const columns = [
    {
      key: "register",
      header: "Register",
      render: (row) => (
        <div>
          <p className="font-semibold text-brand-charcoal">{row.registerName}</p>
          <p className="text-xs text-brand-charcoal/50">{row.locationName ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "requestedBy",
      header: "Requested by",
      render: (row) => row.reopenRequestedByName ?? "—",
    },
    {
      key: "requestedAt",
      header: "Requested",
      render: (row) => (row.reopenRequestedAt ? timeAgo(row.reopenRequestedAt) : "—"),
    },
    {
      key: "opening",
      header: "Opening cash",
      render: (row) => formatCentsAsCurrency(row.openingCashCents),
    },
    {
      key: "status",
      header: "Status",
      render: () => <Badge tone="warning">Pending approval</Badge>,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDenying(row)}>
            Deny
          </Button>
          <Button size="sm" onClick={() => setApproving(row)}>
            Approve
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Registers"
        subtitle="Approve or deny registers that were left open and need manager sign-off to reopen."
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && sessions.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/15 bg-white p-10 text-center">
          <ShieldAlert className="size-8 text-brand-charcoal/30" aria-hidden="true" />
          <p className="text-sm font-medium text-brand-charcoal/60">No registers are awaiting approval</p>
          <p className="text-xs text-brand-charcoal/40">
            Stuck registers a cashier requests to reopen will show up here.
          </p>
        </div>
      )}

      {(loading || sessions.length > 0) && (
        <DataTable
          columns={columns}
          rows={loading ? [] : sessions}
          emptyMessage={loading ? "Loading…" : "No registers are awaiting approval."}
        />
      )}

      {approving && <ApproveModal session={approving} onClose={() => setApproving(null)} onDone={handleDone} />}
      {denying && <DenyModal session={denying} onClose={() => setDenying(null)} onDone={handleDone} />}

      <h2 className="mt-10 mb-3 font-display text-base font-bold text-brand-charcoal">Register sessions</h2>
      <p className="mb-3 text-sm text-brand-charcoal/60">
        Every register open/close, including past sessions, with cash movements and items sold. Click a row to
        expand.
      </p>

      {historyError && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {historyError}
        </p>
      )}

      {history === null ? (
        <p className="text-sm text-brand-charcoal/50">Loading register sessions…</p>
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-brand-charcoal/50">
          No register sessions recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((session) => (
            <RegisterSessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegistersPage() {
  return (
    <RequireAuth permission="pos:register:approve-reopen">
      <RegistersContent />
    </RequireAuth>
  );
}
