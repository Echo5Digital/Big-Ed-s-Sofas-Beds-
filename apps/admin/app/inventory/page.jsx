"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError } from "@/lib/api/client";

function AdjustModal({ open, onClose, balance, onDone }) {
  const [type, setType] = useState("ADJUSTMENT_INCREASE");
  const [quantity, setQuantity] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // The modal stays mounted between opens (see <AdjustModal> below), so
  // without this its fields would carry over from whatever row was adjusted
  // last — e.g. opening Adjust on a new row would silently show the previous
  // row's quantity and reason code, risking an adjustment on the wrong row
  // going through with stale values.
  function resetForm() {
    setType("ADJUSTMENT_INCREASE");
    setQuantity("");
    setReasonCode("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/inventory/adjust", {
        variantId: balance.variantId,
        locationId: balance.locationId,
        type,
        quantity: Number(quantity),
        reasonCode,
      });
      resetForm();
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to adjust stock.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!balance) return null;

  return (
    <Modal open={open} onClose={handleClose} title={`Adjust Stock — ${balance.sku}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-brand-charcoal/60">
          {balance.productName} at {balance.locationName}. Currently {balance.onHand} on hand.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Adjustment type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            <option value="ADJUSTMENT_INCREASE">Increase on-hand</option>
            <option value="ADJUSTMENT_DECREASE">Decrease on-hand</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Quantity</label>
          <input
            type="number"
            min="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Reason code</label>
          <input
            required
            placeholder="e.g. damaged, found_in_count, shrinkage"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save Adjustment"}
          </Button>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TransferModal({ open, onClose, balance, locations, onDone }) {
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const destinations = locations.filter((l) => l.id !== balance?.locationId);

  // Same reasoning as AdjustModal.resetForm: this modal stays mounted
  // between opens, so without resetting, the destination/quantity/notes from
  // the last transfer would silently reappear when transferring a different
  // row's stock.
  function resetForm() {
    setToLocationId("");
    setQuantity("");
    setNotes("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/inventory/transfer", {
        variantId: balance.variantId,
        fromLocationId: balance.locationId,
        toLocationId,
        quantity: Number(quantity),
        notes: notes || undefined,
      });
      resetForm();
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to transfer stock.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!balance) return null;

  return (
    <Modal open={open} onClose={handleClose} title={`Transfer Stock — ${balance.sku}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-brand-charcoal/60">
          From {balance.locationName}. Available to sell: {balance.availableToSell}.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Destination location</label>
          <select
            required
            value={toLocationId}
            onChange={(e) => setToLocationId(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          >
            <option value="">Select a location</option>
            {destinations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Quantity</label>
          <input
            type="number"
            min="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Transferring…" : "Transfer"}
          </Button>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InventoryContent() {
  const [balances, setBalances] = useState(null);
  const [locations, setLocations] = useState([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [error, setError] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);

  const load = useCallback(() => {
    const query = lowStockOnly ? "?lowStockOnly=true" : "";
    api
      .get(`/inventory/balances${query}`)
      .then((data) => setBalances(data.balances))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load inventory."));
  }, [lowStockOnly]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get("/inventory/locations")
      .then((data) => setLocations(data.locations))
      .catch(() => setLocations([]));
  }, []);

  const columns = [
    { key: "sku", header: "SKU" },
    { key: "productName", header: "Product", render: (r) => r.productName },
    { key: "locationName", header: "Location" },
    { key: "onHand", header: "On Hand" },
    { key: "reserved", header: "Reserved" },
    { key: "quarantined", header: "Quarantined" },
    {
      key: "availableToSell",
      header: "Available",
      render: (r) => (
        <Badge tone={r.availableToSell === 0 ? "danger" : r.availableToSell <= 2 ? "warning" : "success"}>
          {r.availableToSell}
        </Badge>
      ),
    },
    {
      key: "suggestedReorderQty",
      header: "Suggested Reorder",
      render: (r) => (r.suggestedReorderQty > 0 ? r.suggestedReorderQty : "—"),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAdjustTarget(r)}
            className="inline-flex items-center gap-1 rounded-full border border-black/15 px-2.5 py-1 text-xs font-semibold hover:bg-gray-50"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Adjust
          </button>
          <button
            type="button"
            onClick={() => setTransferTarget(r)}
            className="inline-flex items-center gap-1 rounded-full border border-black/15 px-2.5 py-1 text-xs font-semibold hover:bg-gray-50"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            Transfer
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock by location, reservations, and adjustments"
        action={
          <label className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="size-4 rounded border-black/20 text-brand-red focus:ring-brand-red"
            />
            Low stock only
          </label>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataTable columns={columns} rows={balances} emptyMessage="No stock balances found." />

      <AdjustModal
        open={Boolean(adjustTarget)}
        balance={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onDone={() => {
          setAdjustTarget(null);
          load();
        }}
      />
      <TransferModal
        open={Boolean(transferTarget)}
        balance={transferTarget}
        locations={locations}
        onClose={() => setTransferTarget(null)}
        onDone={() => {
          setTransferTarget(null);
          load();
        }}
      />
    </div>
  );
}

export default function InventoryPage() {
  return (
    <RequireAuth permission="inventory:read">
      <InventoryContent />
    </RequireAuth>
  );
}
