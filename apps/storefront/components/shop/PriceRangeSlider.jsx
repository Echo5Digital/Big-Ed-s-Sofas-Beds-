"use client";

// Dual-handle range slider: two overlapping native <input type="range">
// elements sharing one track, each independently draggable, with a filled
// bar drawn between them via inline style (percentage of the min/max bounds).
// No third-party slider library exists in this repo (checked) and none of
// the other apps carry one either, so this is deliberately dependency-free —
// plain range inputs, layered with CSS, is the standard no-dependency way to
// build this.
//
// `min`/`max` are numeric, inclusive bounds (priceBounds from
// ProductGridWithControls). `value` is `{min, max}` in the same units.
// onChange fires continuously while dragging (for the live handle position/
// fill), matching how a slider is expected to feel — committing the filter
// itself is still gated behind the existing Apply button in FilterSidebar,
// same as before, so dragging doesn't re-filter the product grid on every
// pixel of movement.
export default function PriceRangeSlider({ min, max, value, onChange }) {
  const range = Math.max(1, max - min); // avoid divide-by-zero when min === max
  const minPercent = ((value.min - min) / range) * 100;
  const maxPercent = ((value.max - min) / range) * 100;

  function handleMinChange(e) {
    const next = Math.min(Number(e.target.value), value.max);
    onChange({ min: next, max: value.max });
  }

  function handleMaxChange(e) {
    const next = Math.max(Number(e.target.value), value.min);
    onChange({ min: value.min, max: next });
  }

  return (
    <div className="relative h-5 w-full">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-charcoal/10" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-red"
        style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={value.min}
        onChange={handleMinChange}
        aria-label="Minimum price"
        // Once the min thumb is dragged past the slider's midpoint it's
        // closer to the max thumb than to the left edge — raising it above
        // the max thumb here is what keeps it grabbable in that situation
        // instead of getting stuck underneath (the two inputs fully overlap,
        // so without this the lower z-index one is unreachable by mouse/
        // touch once both thumbs are near the same position).
        className={`price-range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent ${
          minPercent > 50 ? "z-20" : "z-10"
        }`}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={value.max}
        onChange={handleMaxChange}
        aria-label="Maximum price"
        className={`price-range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent ${
          minPercent > 50 ? "z-10" : "z-20"
        }`}
      />
    </div>
  );
}
