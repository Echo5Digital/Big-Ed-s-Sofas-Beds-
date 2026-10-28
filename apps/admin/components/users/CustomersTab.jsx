"use client";

import { useEffect, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError } from "@/lib/api/client";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function displayName(customer) {
  return `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || customer.email;
}

// Storefront customers who registered an account (and verified their email),
// with the ability to permanently delete one. Searching and paging happen on
// the server since the list grows with every sign-up.
export default function CustomersTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  // Bumped after a delete to refetch the current page.
  const [reloadToken, setReloadToken] = useState(0);
  // The latest response, tagged with the query it answers. Loading is derived
  // from whether that tag matches the current query, so there's no
  // set-loading-state-inside-an-effect to get out of step.
  const [result, setResult] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // customer awaiting confirmation
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const queryKey = `${debouncedSearch}|${page}|${reloadToken}`;
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

  function closeDeleteDialog() {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/users/customers/${pendingDelete.id}`);
      // Removing the only row on a later page would leave that page empty.
      if (page > 1 && customers?.length === 1) setPage(page - 1);
      setReloadToken((t) => t + 1);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : "Failed to delete the customer.");
      // Already gone (e.g. another admin deleted them): drop the stale row.
      if (err instanceof ApiClientError && err.status === 404) setReloadToken((t) => t + 1);
    } finally {
      setDeleting(false);
    }
  }

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
    {
      key: "actions",
      header: "",
      render: (c) => (
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setPendingDelete(c);
          }}
          aria-label={`Delete ${displayName(c)}`}
          title="Delete customer"
          className="rounded-lg p-2 text-brand-charcoal/50 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand-red"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      ),
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

      <Modal open={Boolean(pendingDelete)} onClose={closeDeleteDialog} title="Delete customer?">
        {pendingDelete && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-brand-charcoal">
              <span className="font-semibold">{displayName(pendingDelete)}</span> ({pendingDelete.email}) will be permanently
              deleted from the database. This can&apos;t be undone.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-brand-charcoal/70">
              <li>Their account is removed immediately, and anyone signed in as them is signed out.</li>
              <li>
                {pendingDelete.orderCount > 0
                  ? `Their ${pendingDelete.orderCount} order${pendingDelete.orderCount === 1 ? "" : "s"} will be kept, but will no longer show a customer.`
                  : "They have no orders."}
              </li>
            </ul>

            {deleteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}

            <div className="flex gap-3">
              <Button icon={Trash2} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Customer"}
              </Button>
              <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
