"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import DataTable from "@/components/ui/DataTable";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";
import { useAuth } from "@/lib/hooks/useAuth";

const STATUS_TONE = {
  DRAFT: "default",
  AWAITING_APPROVAL: "warning",
  APPROVED: "info",
  SENT_TO_VENDOR: "info",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELED: "danger",
};

// The PDF is the document sent to the vendor — it isn't meaningful until the
// order has actually cleared manager approval, so it stays hidden through
// DRAFT/AWAITING_APPROVAL rather than offering a download of numbers that
// might still change before approval.
const DOWNLOADABLE_STATUSES = new Set(["APPROVED", "SENT_TO_VENDOR", "PARTIALLY_RECEIVED", "RECEIVED"]);

function ReceiveModal({ open, onClose, po, onDone }) {
  if (!po) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Receive Stock — ${po.poNumber}`}>
      <ReceiveForm key={po.id} po={po} onClose={onClose} onDone={onDone} />
    </Modal>
  );
}

function ReceiveForm({ po, onClose, onDone }) {
  const [locationId, setLocationId] = useState(po.locationId);
  const [quantities, setQuantities] = useState({});
  const [pendingNotes, setPendingNotes] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const outstandingLines = po.lines.filter((l) => l.receivedQty < l.expectedQty);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const lines = outstandingLines
        .map((l) => ({
          poLineId: l.id,
          acceptedQty: Number(quantities[l.id] || 0),
          pendingNote: pendingNotes[l.id]?.trim() || undefined,
        }))
        .filter((l) => l.acceptedQty > 0);

      if (lines.length === 0) {
        setError("Enter a received quantity for at least one line.");
        setSubmitting(false);
        return;
      }

      await api.post(`/purchasing/purchase-orders/${po.id}/receive`, { locationId, lines });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to record receipt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {outstandingLines.map((line) => {
        const remaining = line.expectedQty - line.receivedQty;
        const qty = Number(quantities[line.id] || 0);
        const willBeShort = qty > 0 && qty < remaining;
        return (
          <div key={line.id} className="flex flex-col gap-2 rounded-lg border border-black/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-charcoal">{line.skuSnapshot}</p>
                <p className="text-xs text-brand-charcoal/50">
                  {line.receivedQty} of {line.expectedQty} received
                </p>
                {line.pendingNote && (
                  <p className="mt-1 text-xs text-amber-700">Previous balance note: {line.pendingNote}</p>
                )}
              </div>
              <input
                type="number"
                min="0"
                max={remaining}
                placeholder="Qty"
                value={quantities[line.id] ?? ""}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))}
                className="w-24 shrink-0 rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
            {willBeShort && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-brand-charcoal/70">
                  Pending note — balance of {remaining - qty} still owed (optional)
                </label>
                <input
                  value={pendingNotes[line.id] ?? ""}
                  onChange={(e) => setPendingNotes((prev) => ({ ...prev, [line.id]: e.target.value }))}
                  placeholder="e.g. remainder backordered, expected next week"
                  className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Recording…" : "Record Receipt"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Editable draft of a PO's location/lines, kept separate from the loaded
// `po` so edits don't show as "saved" until Save actually succeeds. Dollar
// fields are stored as display strings (e.g. "19.99") the same way
// /purchasing/new does, converted back to cents on save.
function draftFromPo(po) {
  return {
    locationId: po.locationId,
    lines: po.lines.map((l) => ({
      id: l.id,
      expectedQty: String(l.expectedQty ?? ""),
      unitCostCents: l.unitCostCents != null ? (l.unitCostCents / 100).toFixed(2) : "",
      expectedDate: l.expectedDate ? new Date(l.expectedDate).toISOString().slice(0, 10) : "",
    })),
  };
}

function PurchaseOrderDetailContent() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [po, setPo] = useState(null);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(() => {
    api
      .get(`/purchasing/purchase-orders/${id}`)
      .then((data) => setPo(data.purchaseOrder))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load purchase order."));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.getCached("/inventory/locations").then((data) => setLocations(data.locations)).catch(() => setLocations([]));
  }, []);

  function startEditing() {
    setSaveError(null);
    setDraft(draftFromPo(po));
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(null);
    setSaveError(null);
  }

  function updateDraftLine(lineId, field, value) {
    setDraft((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === lineId ? { ...l, [field]: value } : l)),
    }));
  }

  async function handleSaveEdits(e) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await api.patch(`/purchasing/purchase-orders/${id}`, {
        locationId: draft.locationId,
        lines: draft.lines.map((l) => ({
          id: l.id,
          expectedQty: Number(l.expectedQty),
          unitCostCents: Math.round(Number(l.unitCostCents) * 100),
          expectedDate: l.expectedDate ? new Date(l.expectedDate).toISOString() : undefined,
        })),
      });
      setEditing(false);
      setDraft(null);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForApproval() {
    setActionError(null);
    try {
      await api.post(`/purchasing/purchase-orders/${id}/submit`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Failed to submit PO.");
    }
  }

  async function handleApprove(approve) {
    setActionError(null);
    try {
      await api.post(`/purchasing/purchase-orders/${id}/approve`, { approve });
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Failed to update PO approval.");
    }
  }

  async function handleDownloadPdf() {
    setActionError(null);
    setDownloading(true);
    try {
      await api.downloadFile(`/purchasing/purchase-orders/${id}/export.pdf`, `${po.poNumber}.pdf`);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!po) {
    return <p className="text-sm text-brand-charcoal/50">Loading…</p>;
  }

  const columns = [
    { key: "sku", header: "SKU", render: (l) => l.skuSnapshot },
    {
      key: "expectedDate",
      header: "Expected Date",
      render: (l) => (l.expectedDate ? new Date(l.expectedDate).toLocaleDateString() : "—"),
    },
    { key: "expectedQty", header: "Expected" },
    { key: "receivedQty", header: "Received" },
    { key: "unitCost", header: "Unit Cost", render: (l) => formatCentsAsCurrency(l.unitCostCents) },
    {
      key: "lineTotal",
      header: "Line Total",
      render: (l) => formatCentsAsCurrency(l.expectedQty * l.unitCostCents + l.taxCents + l.freightCents),
    },
    {
      key: "pendingNote",
      header: "Pending Note",
      render: (l) => (l.pendingNote ? <span className="text-amber-700">{l.pendingNote}</span> : "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title={po.poNumber}
        subtitle={po.supplier?.name}
        action={<Badge tone={STATUS_TONE[po.status]}>{po.status.replaceAll("_", " ")}</Badge>}
      />

      {actionError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      <Card className="mb-6 flex flex-wrap gap-3">
        {po.status === "DRAFT" && hasPermission("purchasing:write") && !editing && (
          <>
            <Button variant="outline" onClick={startEditing}>
              Edit
            </Button>
            <Button onClick={handleSubmitForApproval}>Submit for Approval</Button>
          </>
        )}
        {po.status === "AWAITING_APPROVAL" && hasPermission("purchasing:approve") && (
          <>
            <Button onClick={() => handleApprove(true)}>Approve &amp; Send to Vendor</Button>
            <Button variant="outline" onClick={() => handleApprove(false)}>
              Send Back to Draft
            </Button>
          </>
        )}
        {["SENT_TO_VENDOR", "PARTIALLY_RECEIVED"].includes(po.status) && hasPermission("purchasing:receive") && (
          <Button onClick={() => setReceiveOpen(true)}>Receive Stock</Button>
        )}
        {DOWNLOADABLE_STATUSES.has(po.status) && (
          <Button variant="outline" icon={Download} onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? "Downloading…" : "Download PDF"}
          </Button>
        )}
      </Card>

      {editing ? (
        <form onSubmit={handleSaveEdits} className="flex flex-col gap-4">
          <Card className="flex flex-col gap-1.5 sm:max-w-xs">
            <label className="text-sm font-medium text-brand-charcoal">Receiving location</label>
            <select
              required
              value={draft.locationId}
              onChange={(e) => setDraft((prev) => ({ ...prev, locationId: e.target.value }))}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="font-display text-base font-bold text-brand-charcoal">Line Items</h2>
            {draft.lines.map((line) => {
              const original = po.lines.find((l) => l.id === line.id);
              return (
                <div
                  key={line.id}
                  className="grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-4"
                >
                  <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                    <label className="text-xs font-medium text-brand-charcoal/70">SKU</label>
                    <p className="truncate rounded-lg border border-transparent px-2.5 py-1.5 text-sm text-brand-charcoal">
                      {original?.skuSnapshot}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-brand-charcoal/70">Expected qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={line.expectedQty}
                      onChange={(e) => updateDraftLine(line.id, "expectedQty", e.target.value)}
                      className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-brand-charcoal/70">Unit cost (USD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={line.unitCostCents}
                      onChange={(e) => updateDraftLine(line.id, "unitCostCents", e.target.value)}
                      className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-brand-charcoal/70">Expected date</label>
                    <input
                      type="date"
                      value={line.expectedDate}
                      onChange={(e) => updateDraftLine(line.id, "expectedDate", e.target.value)}
                      className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                </div>
              );
            })}
          </Card>

          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={cancelEditing} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <DataTable columns={columns} rows={po.lines} />
      )}

      <ReceiveModal
        open={receiveOpen}
        po={po}
        onClose={() => setReceiveOpen(false)}
        onDone={() => {
          setReceiveOpen(false);
          load();
        }}
      />
    </div>
  );
}

export default function PurchaseOrderDetailPage() {
  return (
    <RequireAuth permission="purchasing:read">
      <PurchaseOrderDetailContent />
    </RequireAuth>
  );
}
