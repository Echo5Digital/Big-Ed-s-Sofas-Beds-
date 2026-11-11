"use client";

// Left sidebar on desktop (matches the product-edit mock), collapsing to a
// horizontally-scrollable top tab strip on small screens — there's no room
// for a fixed-width rail once the viewport drops below the form's own
// min-width, so it flips layout instead of shrinking into icons.
export default function ProductFormTabs({ tabs, active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Product sections"
      className="flex gap-1 overflow-x-auto border-b border-black/10 pb-px sm:w-48 sm:shrink-0 sm:flex-col sm:gap-1 sm:self-start sm:overflow-visible sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red sm:whitespace-normal ${
            active === tab.key
              ? "bg-brand-red/10 text-brand-red"
              : "text-brand-charcoal/60 hover:bg-brand-charcoal/5 hover:text-brand-charcoal"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
