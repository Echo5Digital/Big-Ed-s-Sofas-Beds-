"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api/client";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Read-only list of storefront customers who registered an account (and
// verified their email). Searching and paging happen on the server since the
// list grows with every sign-up.
export default function CustomersTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  // The latest response, tagged with the query it answers. Loading is derived
  // from whether that tag matches the current query, so there's no
  // set-loading-state-inside-an-effect to get out of step.
  const [result, setResult] = useState(null);

  const queryKey = `${debouncedSearch}|${page}`;
  const loading = result?.key !== queryKey;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // A response that arrives after the query has moved on must not overwrite
    // the newer one.
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("q", debouncedSearch);

    api
      .get(`/users/customers?${params}`)
      .then((data) => {
        if (!cancelled) setResult({ key: queryKey, customers: data.customers, pagination: data.pagination });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({ key: queryKey, error: err instanceof ApiClientError ? err.message : "Failed to load customers." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryKey, debouncedSearch, page]);

  const customers = result?.customers ?? null;
  const total = result?.pagination?.total ?? 0;
  const pageSize = result?.pagination?.pageSize ?? PAGE_SIZE;
  // From the page the *displayed* rows belong to, not the one being loaded.
  const shownPage = result?.pagination?.page ?? 1;
  const from = total === 0 ? 0 : (shownPage - 1) * pageSize + 1;
  const to = from + (customers?.length ?? 0) - 1;
  const error = !loading ? result?.error : null;

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (c) => <span className="font-semibold">{`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—"}</span>,
    },
    { key: "email", header: "Email" },
    { key: "registeredAt", header: "Registered", render: (c) => formatDate(c.registeredAt) },
    {
      key: "orderCount",
      header: "Orders",
      render: (c) => (c.orderCount > 0 ? <Badge tone="info">{c.orderCount}</Badge> : <span className="text-brand-charcoal/40">0</span>),
    },
  ];

  const emptyMessage = loading
    ? "Loading customers…"
    : debouncedSearch
      ? "No customers match your search."
      : "No customers have registered yet.";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal/40" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search customers by name or email"
            className="w-full rounded-lg border border-black/15 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <p className="text-xs text-brand-charcoal/50">
          Customers who created a storefront account and verified their email. Guest checkouts aren&apos;t listed.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div aria-busy={loading} className={loading && customers ? "opacity-60 transition-opacity" : undefined}>
        <DataTable columns={columns} rows={customers} emptyMessage={emptyMessage} />
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brand-charcoal/60">
            Showing {from}&ndash;{to} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={loading || page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
