"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PlusCircle } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api/client";

function emptyLine() {
  return { variantId: "", expectedQty: "", unitCostCents: "" };
}

function NewPurchaseOrderContent() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [variants, setVariants] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/purchasing/suppliers").then((data) => setSuppliers(data.suppliers)).catch(() => setSuppliers([]));
    api.get("/inventory/locations").then((data) => setLocations(data.locations)).catch(() => setLocations([]));
    api
      .get("/catalog/admin/products")
      .then((data) => setVariants(data.products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name })))))
      .catch(() => setVariants([]));
  }, []);

  function updateLine(index, field, value) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
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
    setSubmitting(true);

    try {
      const { purchaseOrder } = await api.post("/purchasing/purchase-orders", {
        supplierId,
        locationId,
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          variantId: l.variantId,
          expectedQty: Number(l.expectedQty),
          unitCostCents: Math.round(Number(l.unitCostCents) * 100),
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
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">Expected date</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
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
            <div key={index} className="grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-5">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-brand-charcoal/70">Variant / SKU</label>
                <select
                  required
                  value={line.variantId}
                  onChange={(e) => updateLine(index, "variantId", e.target.value)}
                  className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                >
                  <option value="">Select a variant</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku} — {v.productName} ({v.name})
                    </option>
                  ))}
                </select>
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
              <div className="flex items-end justify-end">
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
    <RequireAuth>
      <NewPurchaseOrderContent />
    </RequireAuth>
  );
}
