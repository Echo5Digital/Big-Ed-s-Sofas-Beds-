"use client";

import { useEffect, useState } from "react";
import { fieldInputClass } from "@/components/products/FormField";
import { api } from "@/lib/api/client";

// Supplier dropdown for the New/Edit Product forms' Inventory tab. Internal
// data — never shown on the storefront (the public product routes don't return
// it; see serializeProduct's `includeInternal` in apps/api).
//
// `currentSupplier` ({ id, name }) is the product's saved supplier on the Edit
// page. It's always kept selectable, even if that supplier has since been
// deactivated (deactivated suppliers are otherwise hidden from the list, same
// as the New Purchase Order picker) or the list failed to load — otherwise the
// select would silently render "None" and the next save would wipe it.
//
// A failed load is surfaced (with a Retry) rather than swallowed: a silently
// empty list is indistinguishable from "no suppliers exist", which hides a
// transient API failure from staff.
export default function ProductSupplierSelect({ value, onChange, currentSupplier = null }) {
  const [suppliers, setSuppliers] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  // Bumped by Retry to re-run the fetch effect below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/purchasing/suppliers")
      .then((data) => {
        if (cancelled) return;
        setSuppliers(data.suppliers.filter((s) => s.isActive));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  const options =
    currentSupplier && !suppliers.some((s) => s.id === currentSupplier.id)
      ? [...suppliers, currentSupplier]
      : suppliers;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="productSupplier" className="text-sm font-medium text-brand-charcoal">
        Supplier
      </label>
      <select
        id="productSupplier"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldInputClass}
      >
        {/* Placeholder only — disabled + hidden so it never appears as a pickable "None" entry in the list. */}
        <option value="" disabled hidden>
          {status === "loading" ? "Loading suppliers…" : "Select"}
        </option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name.trim()}
          </option>
        ))}
      </select>
      {status === "error" ? (
        <p className="text-xs text-red-700">
          Couldn&apos;t load suppliers.{" "}
          <button type="button" onClick={retry} className="font-semibold underline">
            Retry
          </button>
        </p>
      ) : status === "ready" && options.length === 0 ? (
        <p className="text-xs text-brand-charcoal/60">No active suppliers yet — add one on the Suppliers page.</p>
      ) : (
        <p className="text-xs text-brand-charcoal/60">Internal only — not shown to customers.</p>
      )}
    </div>
  );
}
