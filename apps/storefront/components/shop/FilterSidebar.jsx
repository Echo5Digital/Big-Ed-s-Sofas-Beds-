"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { MATERIAL_FAMILY_ORDER, COLOR_FAMILY_ORDER, materialFamilyLabel, colorFamilyMeta } from "@/lib/productAttributes";
import PriceRangeSlider from "@/components/shop/PriceRangeSlider";

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
  sort,
  onSortChange,
  sortOptions,
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
  availableCategoryTree,
  hideParentCategoryCheckbox,
  selectedCategoryIds,
  onToggleCategory,
  activeFilterCount,
  onResetAll,
  onClose,
}) {
  return (
    <aside
      className="flex flex-col gap-1 rounded-xl border border-brand-charcoal/10 bg-white p-4 lg:sticky lg:overflow-y-auto"
      style={{
        top: "calc(var(--header-height, 80px) + 1rem)",
        maxHeight: "calc(100vh - var(--header-height, 80px) - 2rem)",
      }}
    >
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

      <FilterSection title="Sort By">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="w-full rounded-lg border border-brand-charcoal/15 bg-white px-2.5 py-1.5 text-sm font-medium text-brand-charcoal focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterSection>

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
          <PriceRangeSlider
            min={priceBounds.min}
            max={priceBounds.max}
            value={{
              min: priceInput.min === "" ? priceBounds.min : Number(priceInput.min),
              max: priceInput.max === "" ? priceBounds.max : Number(priceInput.max),
            }}
            onChange={({ min, max }) => onPriceInputChange({ min: String(min), max: String(max) })}
          />
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

      {/* Only rendered when the caller passes a non-empty category tree:
          /shop passes the full site-wide tree, /shop/[category] passes just
          the current room's own parent+children on Living Room/Bedroom/Dining
          (see CATEGORY_FILTER_PARENT_SLUGS in
          app/shop/[category]/page.jsx — Office/Accessories pass none, same
          as every other page). Each top-level category is normally its own
          checkbox (selecting it rolls up every product in its
          sub-categories too — see expandCategoryIdWithChildren in
          lib/categoryTree.js) with its children listed right under it,
          indented, as their own checkboxes. hideParentCategoryCheckbox skips
          that parent checkbox and the indent: on /shop/[category] the parent
          IS the page you're already on, so a redundant "Living Room"
          checkbox while standing on /shop/living-room would be confusing —
          only the sub-category checkboxes are useful there. Placed right
          after Price (ahead of Material/Color): narrowing by room/category
          first is the more common shopper flow than narrowing by material or
          color first. Collapsed by default (unlike every other section
          here): on /shop it's the longest list in the sidebar by far (5
          parents + ~20 children), so left open it would push every other
          filter below the fold. */}
      {availableCategoryTree?.length > 0 && (
        <FilterSection title="Category" defaultOpen={false}>
          <div className="flex flex-col gap-3">
            {availableCategoryTree.map((parent) =>
              hideParentCategoryCheckbox ? (
                parent.children.map((child) => (
                  <label
                    key={child.id}
                    className="flex cursor-pointer items-center gap-2.5 text-sm text-brand-charcoal"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(child.id)}
                      onChange={() => onToggleCategory(child.id)}
                      className="size-4 rounded border-brand-charcoal/30 text-brand-red focus:ring-brand-red"
                    />
                    {child.name}
                  </label>
                ))
              ) : (
                <div key={parent.id} className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-brand-charcoal">
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(parent.id)}
                      onChange={() => onToggleCategory(parent.id)}
                      className="size-4 rounded border-brand-charcoal/30 text-brand-red focus:ring-brand-red"
                    />
                    {parent.name}
                  </label>
                  {parent.children.length > 0 && (
                    <div className="ml-6 flex flex-col gap-2 border-l border-brand-charcoal/10 pl-3">
                      {parent.children.map((child) => (
                        <label
                          key={child.id}
                          className="flex cursor-pointer items-center gap-2.5 text-sm text-brand-charcoal"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(child.id)}
                            onChange={() => onToggleCategory(child.id)}
                            className="size-4 rounded border-brand-charcoal/30 text-brand-red focus:ring-brand-red"
                          />
                          {child.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </FilterSection>
      )}

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
