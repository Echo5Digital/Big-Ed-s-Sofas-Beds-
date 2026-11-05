"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Clicks that start on (or inside) one of these keep their own behaviour and
// must not also trigger the row-level navigation.
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, [role='button']";

// Generic horizontally-scrollable data table used across admin list views.
// Scrolls within its own container on small screens instead of overflowing
// the page, per the mobile-responsiveness requirement.
//
// Optional `rowHref(row)` makes the whole row clickable (not just a link
// inside one cell). Keep a real <Link> in one of the cells as well — it gives
// keyboard users a focusable target and supports "open in new tab".
//
// Optional `stickyScrollbar` is for long tables: the table's own horizontal
// scrollbar sits at the very bottom of the table, so on a long list it is
// off-screen until the page is scrolled to the end. With this on, a synced
// scrollbar is pinned to the bottom of the viewport while any part of the
// table is visible.
export default function DataTable({
  columns,
  rows,
  emptyMessage = "No records found.",
  rowHref,
  stickyScrollbar = false,
}) {
  const router = useRouter();
  const scrollerRef = useRef(null);
  const barRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const hasRows = Boolean(rows && rows.length > 0);

  // Keep the pinned scrollbar's track the same width as the table's scrollable
  // content, and only show it when the table actually overflows.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!stickyScrollbar || !scroller) return undefined;

    const measure = () => {
      // The bar spans the table's full outer width (offsetWidth) while the
      // table scrolls within its inner width (clientWidth — less the border).
      // Pad the track by that difference so both have the same max scrollLeft
      // and dragging the bar to the end reaches the table's last pixel.
      setContentWidth(scroller.scrollWidth + (scroller.offsetWidth - scroller.clientWidth));
      setOverflowing(scroller.scrollWidth > scroller.clientWidth + 1);
    };
    measure();

    // Observe the scroller (viewport resize) and the table itself (column
    // widths change as rows load / filter).
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => observer.disconnect();
  }, [stickyScrollbar, hasRows]);

  // Mirror scrollLeft between the table and the pinned bar. Writing an equal
  // value fires no scroll event, so the two can't feed back into each other.
  function syncScroll(from, to) {
    if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  }

  if (!hasRows) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-brand-charcoal/50">
        {emptyMessage}
      </div>
    );
  }

  function handleRowClick(event, href) {
    if (event.defaultPrevented || event.target.closest(INTERACTIVE_SELECTOR)) return;
    // Don't hijack the click if the user is selecting text.
    if (window.getSelection?.()?.toString()) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  }

  // In sticky mode the table's own (bottom-of-table) scrollbar is hidden —
  // it is replaced by the pinned bar below. Wheel / shift-wheel / touch
  // scrolling on the table itself keeps working.
  const scrollerClass = stickyScrollbar
    ? "overflow-x-auto rounded-xl border border-black/10 bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "overflow-x-auto rounded-xl border border-black/10 bg-white";

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={stickyScrollbar ? () => syncScroll(scrollerRef.current, barRef.current) : undefined}
        className={scrollerClass}
      >
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-gray-50 text-left">
              {columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-4 py-3 font-semibold text-brand-charcoal/70">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const href = rowHref ? rowHref(row) : null;
              return (
                <tr
                  key={row.id ?? i}
                  onClick={href ? (event) => handleRowClick(event, href) : undefined}
                  className={`border-b border-black/5 last:border-0 hover:bg-gray-50${href ? " cursor-pointer" : ""}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-4 py-3 text-brand-charcoal">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stickyScrollbar && (
        <div
          ref={barRef}
          onScroll={() => syncScroll(barRef.current, scrollerRef.current)}
          hidden={!overflowing}
          aria-hidden="true"
          data-testid="sticky-scrollbar"
          className="sticky bottom-0 z-10 overflow-x-auto border-t border-black/10 bg-white [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/30 [&::-webkit-scrollbar-track]:bg-black/5"
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
