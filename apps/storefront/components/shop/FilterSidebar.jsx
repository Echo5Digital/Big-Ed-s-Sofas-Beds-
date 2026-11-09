"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { MATERIAL_FAMILY_ORDER, COLOR_FAMILY_ORDER, materialFamilyLabel, colorFamilyMeta } from "@/lib/productAttributes";

function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-brand-charcoal/10 py-4 first:pt-0 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-brand-charcoal"
      >
        {title}
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// Renders only the Material/Color options that at least one product in the
// current result set actually has (via `availableKeys`) — an empty checkbox
// that can never match anything is worse than no checkbox, especially since
// a third to a half of products have no material/color set at all (see
// lib/productAttributes.js for why the source data is this incomplete).
export default function FilterSidebar({
  priceInput,
  onPriceInputChange,
  onApplyPrice,
  onResetPrice,
  priceBounds,
  inStockOnly,
  onInStockChange,
  availableMaterials,
  selectedMaterials,
  onToggleMaterial,
  availableColors,
  selectedColors,
  onToggleColor,
  activeFilterCount,
  onResetAll,
  onClose,
}) {
  return (
    <aside className="flex flex-col gap-1 rounded-xl border border-brand-charcoal/10 bg-white p-4 lg:sticky lg:top-4 lg:h-fit">
      <div className="flex items-center justify-between pb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-charcoal">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
        </h2>
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onResetAll}
              className="flex items-center gap-1 text-xs font-semibold text-brand-red-dark hover:underline"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear ({activeFilterCount})
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="flex size-9 items-center justify-center rounded-full text-brand-charcoal hover:bg-brand-charcoal/5 lg:hidden"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <FilterSection title="Availability">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-brand-charcoal">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockChange(e.target.checked)}
            className="size-4 rounded border-brand-charcoal/30 text-brand-red focus:ring-brand-red"
          />
          In Stock Only
        </label>
      </FilterSection>

      <FilterSection title="Price Range">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-brand-charcoal/50">Min</label>
              <input
                type="number"
                min={0}
                value={priceInput.min}
                onChange={(e) => onPriceInputChange({ ...priceInput, min: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-brand-charcoal/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
            <span className="mt-4 text-brand-charcoal/40">–</span>
            <div className="flex-1">
              <label className="text-xs text-brand-charcoal/50">Max</label>
              <input
                type="number"
                min={0}
                value={priceInput.max}
                onChange={(e) => onPriceInputChange({ ...priceInput, max: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-brand-charcoal/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
          </div>
          <p className="text-xs text-brand-charcoal/40">
            Catalog range: ${priceBounds.min.toLocaleString()} – ${priceBounds.max.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApplyPrice}
              className="flex-1 rounded-full bg-brand-red px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-red-dark"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onResetPrice}
              aria-label="Reset price filter"
              className="flex items-center justify-center rounded-full border border-brand-charcoal/15 px-3 py-1.5 text-brand-charcoal/60 hover:border-brand-red hover:text-brand-red-dark"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </FilterSection>

      {availableMaterials.length > 0 && (
        <FilterSection title="Material">
          <div className="flex flex-col gap-2">
            {MATERIAL_FAMILY_ORDER.filter((key) => availableMaterials.includes(key)).map((key) => (
              <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm text-brand-charcoal">
                <input
                  type="checkbox"
                  checked={selectedMaterials.includes(key)}
                  onChange={() => onToggleMaterial(key)}
                  className="size-4 rounded border-brand-charcoal/30 text-brand-red focus:ring-brand-red"
                />
                {materialFamilyLabel(key)}
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {availableColors.length > 0 && (
        <FilterSection title="Color">
          <div className="flex flex-col gap-2.5">
            {COLOR_FAMILY_ORDER.filter((key) => availableColors.includes(key)).map((key) => {
              const meta = colorFamilyMeta(key);
              const isSelected = selectedColors.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleColor(key)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-sm transition-colors ${
                    isSelected ? "bg-brand-red/5 text-brand-red-dark" : "text-brand-charcoal hover:bg-brand-charcoal/5"
                  }`}
                >
                  <span
                    className={`size-4 shrink-0 rounded-full border ${isSelected ? "border-brand-red ring-2 ring-brand-red/30" : "border-brand-charcoal/20"}`}
                    style={{ backgroundColor: meta?.swatch }}
                    aria-hidden="true"
                  />
                  {meta?.label ?? key}
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}
    </aside>
  );
}
