"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Search, SlidersHorizontal } from "lucide-react";
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

// Adjust/Transfer act on a single location's balance, but a table row is now
// one product with a balance per location (see groupByVariant below) — this
// asks which location's balance to act on before handing off to the same
// AdjustModal/TransferModal those already-built flows use.
function LocationPickerModal({ open, onClose, title, product, locationBalances, onPick }) {
  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-brand-charcoal/60">
          {product.productName} ({product.sku}) — choose a location.
        </p>
        {locationBalances.map((lb) => (
          <button
            key={lb.locationId}
            type="button"
            onClick={() => onPick(lb)}
            className="flex items-center justify-between rounded-lg border border-black/15 px-3 py-2.5 text-left text-sm font-semibold text-brand-charcoal hover:bg-gray-50"
          >
            {lb.locationName}
            <span className="text-brand-charcoal/60">{lb.availableToSell} available</span>
          </button>
        ))}
      </div>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balances, setBalances] = useState(null);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState("");

  // The URL is the source of truth for this filter so it can be deep-linked —
  // the dashboard's "Requires Attention → View all" opens
  // /inventory?lowStockOnly=true — and stays correct across back/forward and
  // sidebar navigation (a plain useState would keep a stale value when only
  // the query string changes on this same page).
  const lowStockOnly = searchParams.get("lowStockOnly") === "true";

  function setLowStockOnly(checked) {
    router.replace(checked ? "/inventory?lowStockOnly=true" : "/inventory", { scroll: false });
  }
  const [error, setError] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  // Set to the grouped product row while its location picker is open; cleared
  // once a location is chosen (which then opens the real Adjust/Transfer
  // modal above) or the picker is dismissed.
  const [pickingLocationFor, setPickingLocationFor] = useState(null);
  const [pickerAction, setPickerAction] = useState(null);

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
      .getCached("/inventory/locations")
      .then((data) => setLocations(data.locations))
      .catch(() => setLocations([]));
  }, []);

  // One StockBalance row exists per variant+location (see GET /inventory/balances),
  // which used to mean the same product appeared twice — once per location.
  // Grouping by variantId here collapses that into a single product row with
  // a balance per location, shown as its own column below.
  const groupedBalances = useMemo(() => {
    if (!balances) return balances;
    const byVariant = new Map();
    for (const b of balances) {
      if (!byVariant.has(b.variantId)) {
        byVariant.set(b.variantId, {
          id: b.variantId,
          variantId: b.variantId,
          sku: b.sku,
          productName: b.productName,
          locationBalances: [],
        });
      }
      byVariant.get(b.variantId).locationBalances.push(b);
    }
    return Array.from(byVariant.values());
  }, [balances]);

  const filteredBalances = useMemo(() => {
    if (!groupedBalances) return groupedBalances;
    const query = search.trim().toLowerCase();
    if (!query) return groupedBalances;
    return groupedBalances.filter(
      (b) => b.sku.toLowerCase().includes(query) || b.productName.toLowerCase().includes(query)
    );
  }, [groupedBalances, search]);

  const openAdjust = useCallback((product) => {
    if (product.locationBalances.length === 1) {
      setAdjustTarget(product.locationBalances[0]);
      return;
    }
    setPickerAction("adjust");
    setPickingLocationFor(product);
  }, []);

  const openTransfer = useCallback((product) => {
    if (product.locationBalances.length === 1) {
      setTransferTarget(product.locationBalances[0]);
      return;
    }
    setPickerAction("transfer");
    setPickingLocationFor(product);
  }, []);

  function handleLocationPicked(locationBalance) {
    if (pickerAction === "adjust") setAdjustTarget(locationBalance);
    if (pickerAction === "transfer") setTransferTarget(locationBalance);
    setPickingLocationFor(null);
    setPickerAction(null);
  }

  // One column per active location (Showroom, Warehouse, ...) instead of a
  // single "Location" column with duplicate product rows. Available to Sell
  // is shown rather than On Hand, since that's the number staff act on day to
  // day — see inventory.service.js: onHand - reserved - quarantined.
  const columns = useMemo(
    () => [
      {
        key: "actions",
        header: "",
        render: (r) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openAdjust(r)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              Adjust
            </button>
            <button
              type="button"
              onClick={() => openTransfer(r)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
            >
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              Transfer
            </button>
          </div>
        ),
      },
      { key: "sku", header: "SKU" },
      { key: "productName", header: "Product", render: (r) => r.productName },
      ...locations.map((location) => ({
        key: `location-${location.id}`,
        header: location.name,
        render: (r) => {
          const lb = r.locationBalances.find((b) => b.locationId === location.id);
          if (!lb) return "—";
          return (
            <Badge tone={lb.availableToSell === 0 ? "danger" : lb.availableToSell <= 2 ? "warning" : "success"}>
              {lb.availableToSell}
            </Badge>
          );
        },
      })),
      {
        key: "suggestedReorderQty",
        header: "Suggested Reorder",
        render: (r) => {
          const total = r.locationBalances.reduce((sum, lb) => sum + lb.suggestedReorderQty, 0);
          return total > 0 ? total : "—";
        },
      },
    ],
    [locations, openAdjust, openTransfer]
  );

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock by location, reservations, and adjustments"
        action={
          <label className="flex min-h-9 items-center gap-2 py-1.5 text-sm font-medium text-brand-charcoal">
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

      <div className="relative mb-4 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal/40"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by SKU or name"
          aria-label="Search inventory by SKU or name"
          className="w-full rounded-lg border border-black/15 py-2 pl-9 pr-3 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <DataTable
        columns={columns}
        stickyScrollbar
        rows={filteredBalances}
        emptyMessage={
          balances && balances.length > 0 ? "No stock balances match your search." : "No stock balances found."
        }
      />

      <LocationPickerModal
        open={Boolean(pickingLocationFor)}
        title={pickerAction === "transfer" ? "Transfer Stock — choose location" : "Adjust Stock — choose location"}
        product={pickingLocationFor}
        locationBalances={pickingLocationFor?.locationBalances ?? []}
        onClose={() => {
          setPickingLocationFor(null);
          setPickerAction(null);
        }}
        onPick={handleLocationPicked}
      />
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
      {/* useSearchParams needs a Suspense boundary so the route can still be prerendered. */}
      <Suspense fallback={null}>
        <InventoryContent />
      </Suspense>
    </RequireAuth>
  );
}
