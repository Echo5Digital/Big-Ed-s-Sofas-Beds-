"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

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

  const load = useCallback(() => {
    return api
      .get("/pos/registers/pending-reopens")
      .then((data) => setSessions(data.sessions))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load pending reopen requests."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone() {
    setApproving(null);
    setDenying(null);
    load();
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
