"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PlusCircle } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import VariantPicker from "@/components/purchasing/VariantPicker";
import { api, ApiClientError } from "@/lib/api/client";
import { INVENTORY_TO_PO_STORAGE_KEY } from "@/lib/inventoryToPurchaseOrder";

function emptyLine() {
  return { variant: null, expectedQty: "", unitCostCents: "", expectedDate: "" };
}

// A variant picked straight from Inventory's low-stock selection doesn't go
// through VariantPicker's search, so it's reshaped into the same {id, sku,
// name, productName} value VariantPicker normally hands back, keeping one
// line-rendering path regardless of where the line came from.
function lineFromInventoryHandoff(entry) {
  return {
    variant: { id: entry.variantId, sku: entry.sku, name: "", productName: entry.productName },
    expectedQty: String(entry.expectedQty ?? ""),
    unitCostCents: entry.unitCostCents ? (entry.unitCostCents / 100).toFixed(2) : "",
    expectedDate: "",
  };
}

// One-time consume of the selection Inventory's "Create Purchase Order"
// action handed off via sessionStorage — cleared immediately after reading
// so a later direct visit to this page starts from a clean, empty form. This
// is read during render (via useState's lazy initializer below), not an
// effect, since it's initializing state from an external read rather than
// subscribing to one over time.
function consumeInventoryHandoff() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("fromInventory") !== "1") return null;
  const raw = sessionStorage.getItem(INVENTORY_TO_PO_STORAGE_KEY);
  sessionStorage.removeItem(INVENTORY_TO_PO_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Malformed/stale sessionStorage payload — ignore and start with the
    // normal empty form rather than failing the page.
    return null;
  }
}

function NewPurchaseOrderContent() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [handoff] = useState(consumeInventoryHandoff);
  const [supplierId, setSupplierId] = useState(() => handoff?.supplierId ?? "");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState(() =>
    Array.isArray(handoff?.lines) && handoff.lines.length > 0
      ? handoff.lines.map(lineFromInventoryHandoff)
      : [emptyLine()]
  );
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Deactivated suppliers can't be chosen for a new PO.
    api
      .get("/purchasing/suppliers")
      .then((data) => setSuppliers(data.suppliers.filter((s) => s.isActive)))
      .catch(() => setSuppliers([]));
    api.getCached("/inventory/locations").then((data) => setLocations(data.locations)).catch(() => setLocations([]));
  }, []);

  function updateLine(index, field, value) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function pickVariant(index, variant) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              variant,
              // Preset from the product's last known supplier cost — still
              // editable afterward, not locked.
              unitCostCents:
                variant && typeof variant.costCents === "number" ? (variant.costCents / 100).toFixed(2) : l.unitCostCents,
            }
          : l
      )
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (lines.some((l) => !l.variant)) {
      setError("Select a variant for every line item.");
      return;
    }

    setSubmitting(true);

    try {
      const { purchaseOrder } = await api.post("/purchasing/purchase-orders", {
        supplierId,
        locationId,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          variantId: l.variant?.id,
          expectedQty: Number(l.expectedQty),
          unitCostCents: Math.round(Number(l.unitCostCents) * 100),
          expectedDate: l.expectedDate ? new Date(l.expectedDate).toISOString() : undefined,
        })),
      });
      router.push(`/purchasing/${purchaseOrder.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create purchase order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Purchase Order" subtitle="Draft a PO for manager approval before sending to the vendor" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">Supplier</label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              <option value="">Select a supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">Receiving location</label>
            <select
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            >
              <option value="">Select a location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-full flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-charcoal">Line Items</h2>
            <Button type="button" variant="outline" size="sm" icon={PlusCircle} onClick={addLine}>
              Add line
            </Button>
          </div>

          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-6">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-brand-charcoal/70">Variant / SKU</label>
                <VariantPicker value={line.variant} onChange={(variant) => pickVariant(index, variant)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-brand-charcoal/70">Expected qty</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={line.expectedQty}
                  onChange={(e) => updateLine(index, "expectedQty", e.target.value)}
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
                  onChange={(e) => updateLine(index, "unitCostCents", e.target.value)}
                  className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-brand-charcoal/70">Expected date</label>
                <input
                  type="date"
                  value={line.expectedDate}
                  onChange={(e) => updateLine(index, "expectedDate", e.target.value)}
                  className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>
              <div className="col-span-2 flex items-center justify-end sm:col-span-1 sm:items-end">
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    aria-label="Remove line"
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save Draft PO"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/purchasing")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <RequireAuth permission="purchasing:write">
      <NewPurchaseOrderContent />
    </RequireAuth>
  );
}
