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

function PurchaseOrderDetailContent() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [po, setPo] = useState(null);
  const [error, setError] = useState(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/purchasing/purchase-orders/${id}`)
      .then((data) => setPo(data.purchaseOrder))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load purchase order."));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
        {po.status === "DRAFT" && hasPermission("purchasing:write") && (
          <Button onClick={handleSubmitForApproval}>Submit for Approval</Button>
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
        <Button variant="outline" icon={Download} onClick={handleDownloadPdf} disabled={downloading}>
          {downloading ? "Downloading…" : "Download PDF"}
        </Button>
      </Card>

      <DataTable columns={columns} rows={po.lines} />

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
