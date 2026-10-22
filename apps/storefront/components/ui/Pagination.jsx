import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Server-rendered, link-based pagination (no client state) to match
// /shop and /shop/[category] being async server components with live,
// never-stale-cached catalog data — see those pages' `instant = false`.
// Page number is carried in the URL (?page=N) so it's bookmarkable/
// shareable and works with JS disabled.
function pageHref(basePath, page) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

// Collapses a long page range to first/last + a window around the current
// page, with "…" gaps — standard pattern so the control doesn't grow
// unbounded for large catalogs.
function getPageNumbers(current, totalPages) {
  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  return [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
}

export default function Pagination({ page, totalPages, basePath }) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5 sm:gap-2">
      <Link
        href={pageHref(basePath, page - 1)}
        aria-label="Previous page"
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={`flex size-9 items-center justify-center rounded-full border border-brand-charcoal/15 text-brand-charcoal transition-colors sm:size-10 ${
          page <= 1
            ? "pointer-events-none opacity-40"
            : "hover:border-brand-red hover:text-brand-red-dark"
        }`}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>

      {pageNumbers.map((pageNumber, index) => {
        const prevPageNumber = pageNumbers[index - 1];
        const showGap = prevPageNumber && pageNumber - prevPageNumber > 1;

        return (
          <span key={pageNumber} className="flex items-center gap-1.5 sm:gap-2">
            {showGap && <span className="px-1 text-sm text-brand-charcoal/40">&hellip;</span>}
            <Link
              href={pageHref(basePath, pageNumber)}
              aria-label={`Page ${pageNumber}`}
              aria-current={pageNumber === page ? "page" : undefined}
              className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-colors sm:size-10 ${
                pageNumber === page
                  ? "bg-brand-red text-white"
                  : "text-brand-charcoal hover:bg-brand-charcoal/5"
              }`}
            >
              {pageNumber}
            </Link>
          </span>
        );
      })}

      <Link
        href={pageHref(basePath, page + 1)}
        aria-label="Next page"
        aria-disabled={page >= totalPages}
        tabIndex={page >= totalPages ? -1 : undefined}
        className={`flex size-9 items-center justify-center rounded-full border border-brand-charcoal/15 text-brand-charcoal transition-colors sm:size-10 ${
          page >= totalPages
            ? "pointer-events-none opacity-40"
            : "hover:border-brand-red hover:text-brand-red-dark"
        }`}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
