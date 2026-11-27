"use client";

// Horizontal, equal-width ("equidistant") tab strip for the Reports page —
// unlike ProductFormTabs (a collapsing sidebar rail meant for a form with
// many sections), 5 short top-level report sections read better as one fixed
// row at every viewport width, so this uses a grid instead of a flex rail.
export default function ReportsTabs({ tabs, active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Report sections"
      className="grid grid-cols-5 gap-1 rounded-xl border border-black/10 bg-white p-1 shadow-sm"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-center text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
            active === tab.key
              ? "bg-brand-red/10 text-brand-red"
              : "text-brand-charcoal/60 hover:bg-brand-charcoal/5 hover:text-brand-charcoal"
          }`}
        >
          <span className="truncate">{tab.label}</span>
          {Boolean(tab.badge) && (
            <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
              {tab.badge > 9 ? "9+" : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
