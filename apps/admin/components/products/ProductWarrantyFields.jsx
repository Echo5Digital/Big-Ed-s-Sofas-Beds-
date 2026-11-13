"use client";

import FormField, { fieldInputClass } from "@/components/products/FormField";

// Warranty tab body for the New/Edit Product forms. Unlike Brand/Supplier this
// is public: ticking the box makes the storefront product page show
// "Warrantied", and the note below it is rendered there as "Warranty Details"
// under the description. The note field only appears while the box is ticked
// (the API also clears the note whenever the box is un-ticked).
export default function ProductWarrantyFields({ isWarrantied, onToggle, note, onNoteChange }) {
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="isWarrantied" className="flex cursor-pointer items-start gap-3">
        <input
          id="isWarrantied"
          type="checkbox"
          checked={isWarrantied}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 size-4 rounded border-black/30 text-brand-red focus:ring-brand-red"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-brand-charcoal">Warrantied</span>
          <span className="text-xs text-brand-charcoal/60">
            Shows a &ldquo;Warrantied&rdquo; marker on this product&rsquo;s storefront page.
          </span>
        </span>
      </label>

      {isWarrantied && (
        <FormField
          id="warrantyNote"
          label="Warranty note"
          hint="Shown on the storefront product page under the description, as “Warranty Details”."
        >
          <textarea
            id="warrantyNote"
            rows={5}
            maxLength={2000}
            placeholder="e.g. 1-year limited warranty covering frame and mechanisms."
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className={fieldInputClass}
          />
        </FormField>
      )}
    </div>
  );
}
