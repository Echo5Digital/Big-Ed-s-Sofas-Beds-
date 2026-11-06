"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Client-state counterpart to components/ui/Pagination.jsx (which is
// link/URL-based, for pages with no client-side filtering). Needed here
// because the page count itself now depends on live filter/sort state in
// ProductGridWithControls — filtering 120 products down to 8 changes the
// page count from 6 to 1, which a URL-driven ?page=N control can't react to
// the same way. Not bookmarkable/shareable by URL as a tradeoff, same as any
// client-side-filtered result set.
function getPageNumbers(current, totalPages) {
  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  return [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
}

export default function ClientPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(page, totalPages);

  function goTo(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    onPageChange(nextPage);
    // Jumping pages on a long filtered list should return the shopper to the
    // top of the grid, not leave them scrolled past where the new page's
    // results start rendering.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={() => goTo(page - 1)}
        aria-label="Previous page"
        disabled={page <= 1}
        className={`flex size-9 items-center justify-center rounded-full border border-brand-charcoal/15 text-brand-charcoal transition-colors sm:size-10 ${
          page <= 1 ? "pointer-events-none opacity-40" : "hover:border-brand-red hover:text-brand-red-dark"
        }`}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>

      {pageNumbers.map((pageNumber, index) => {
        const prevPageNumber = pageNumbers[index - 1];
        const showGap = prevPageNumber && pageNumber - prevPageNumber > 1;

        return (
          <span key={pageNumber} className="flex items-center gap-1.5 sm:gap-2">
            {showGap && <span className="px-1 text-sm text-brand-charcoal/40">&hellip;</span>}
            <button
              type="button"
              onClick={() => goTo(pageNumber)}
              aria-label={`Page ${pageNumber}`}
              aria-current={pageNumber === page ? "page" : undefined}
              className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-colors sm:size-10 ${
                pageNumber === page ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-brand-charcoal/5"
              }`}
            >
              {pageNumber}
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={() => goTo(page + 1)}
        aria-label="Next page"
        disabled={page >= totalPages}
        className={`flex size-9 items-center justify-center rounded-full border border-brand-charcoal/15 text-brand-charcoal transition-colors sm:size-10 ${
          page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-brand-red hover:text-brand-red-dark"
        }`}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
