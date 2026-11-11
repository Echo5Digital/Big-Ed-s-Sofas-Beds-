"use client";

// Single-column stacked field wrapper shared by every tab in the product
// form — keeps label spacing, input height, and focus ring identical
// everywhere instead of each tab reinventing its own input classes.
export default function FormField({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-brand-charcoal">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-brand-charcoal/60">{hint}</p>}
    </div>
  );
}

export const fieldInputClass =
  "rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red";
