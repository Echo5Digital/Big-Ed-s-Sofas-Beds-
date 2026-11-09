"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlusCircle, Search, Trash2 } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const STATUS_TONE = { ACTIVE: "success", DRAFT: "default", ARCHIVED: "warning" };

function ProductsContent() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    api
      .get("/catalog/admin/products")
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load products."));
  }, []);

  useEffect(() => {
    api
      .getCached("/catalog/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  const [dealsPending, setDealsPending] = useState(() => new Set());
  const [pendingDelete, setPendingDelete] = useState(null); // product awaiting confirmation
  const [deleteBlockers, setDeleteBlockers] = useState(null); // set once DELETE comes back 409 ("has history")
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function toggleDeal(product, nextValue) {
    setDealsPending((prev) => new Set(prev).add(product.id));
    try {
      await api.patch(`/catalog/products/${product.id}`, { isDeal: nextValue });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, isDeal: nextValue } : p)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update deal status.");
    } finally {
      setDealsPending((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteBlockers(null);
    setDeleteError(null);
  }

  // Tries a real permanent delete first. If the product has stock, order,
  // reservation, transfer, or purchase-order history anywhere across its
  // variants, the API refuses with 409 and the blocker counts — shown here so
  // staff can fall back to Archive instead, rather than hitting a dead end.
  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/catalog/products/${pendingDelete.id}`);
      setProducts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
      setDeleteBlockers(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setDeleteBlockers(err.details ?? {});
      } else if (err instanceof ApiClientError && err.status === 404) {
        // Already gone (e.g. another admin deleted it): drop the stale row.
        setProducts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
        setPendingDelete(null);
      } else {
        setDeleteError(err instanceof ApiClientError ? err.message : "Failed to delete the product.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function confirmArchive() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const { product } = await api.patch(`/catalog/products/${pendingDelete.id}/archive`, {});
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, status: product.status } : p)));
      setPendingDelete(null);
      setDeleteBlockers(null);
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : "Failed to archive the product.");
    } finally {
      setDeleting(false);
    }
  }

  const rows = useMemo(() => {
    const allRows = (products ?? []).flatMap((product) =>
      product.variants.map((variant) => ({
        id: variant.id,
        product,
        variant,
      }))
    );

    const query = search.trim().toLowerCase();
    return allRows.filter((r) => {
      const matchesSearch =
        !query || r.variant.sku.toLowerCase().includes(query) || r.product.name.toLowerCase().includes(query);
      const matchesCategory =
        !categoryId ||
        r.product.category?.id === categoryId ||
        r.product.categories.some((c) => c.id === categoryId);
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryId]);

  const columns = [
    { key: "sku", header: "SKU", render: (r) => r.variant.sku },
    { key: "name", header: "Product", render: (r) => r.product.name },
    { key: "category", header: "Category", render: (r) => r.product.displayCategory?.name ?? "—" },
    {
      key: "price",
      header: "Sale Price",
      render: (r) => (
        <div className="flex items-baseline gap-1.5">
          <span>{formatCentsAsCurrency(r.variant.priceCents)}</span>
          {r.variant.compareAtCents && (
            <span className="text-xs text-brand-charcoal/40 line-through">
              {formatCentsAsCurrency(r.variant.compareAtCents)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "stock",
      header: "Available",
      render: (r) => r.variant.availability.totalAvailable,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={STATUS_TONE[r.product.status]}>{r.product.status}</Badge>,
    },
    {
      key: "deals",
      header: "Deals",
      render: (r) => (
        <input
          type="checkbox"
          checked={Boolean(r.product.isDeal)}
          disabled={dealsPending.has(r.product.id)}
          onChange={(e) => toggleDeal(r.product, e.target.checked)}
          aria-label={`Show ${r.product.name} on the Deals page`}
          className="size-4 rounded border-black/30 text-brand-red focus:ring-brand-red disabled:opacity-50"
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center justify-end gap-3">
          <Link href={`/products/${r.product.id}`} className="font-semibold text-brand-red hover:text-brand-red-dark">
            Edit
          </Link>
          {/* Rows are per-variant, but delete is a product-level action — only
              render it once, on that product's first variant row, so a
              multi-variant product doesn't show the button N times. */}
          {r.product.variants[0]?.id === r.variant.id && (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeleteBlockers(null);
                setPendingDelete(r.product);
              }}
              aria-label={`Delete ${r.product.name}`}
              title="Delete product"
              className="rounded-lg p-1.5 text-brand-charcoal/50 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand-red"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Catalog, variants, and pricing"
        action={
          <Link
            href="/products/new"
            className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
          >
            <PlusCircle className="size-4" aria-hidden="true" />
            New Product
          </Link>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU or name"
            aria-label="Search products by SKU or name"
            className="w-full rounded-lg border border-black/15 py-2 pl-9 pr-3 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red sm:w-56"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        stickyScrollbar
        rows={products === null ? null : rows}
        emptyMessage={
          products !== null && products.length > 0
            ? "No products match your search or filter."
            : "No products yet. Create your first product to get started."
        }
      />

      <Modal open={Boolean(pendingDelete)} onClose={closeDeleteDialog} title="Delete product?">
        {pendingDelete && (
          <div className="flex flex-col gap-4">
            {deleteBlockers ? (
              <>
                <p className="text-sm text-brand-charcoal">
                  <span className="font-semibold">{pendingDelete.name}</span> has stock, order, reservation,
                  transfer, or purchase-order history, so it can&apos;t be permanently deleted — that history has to
                  stay intact.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-brand-charcoal/70">
                  {deleteBlockers.stockMovementCount > 0 && <li>{deleteBlockers.stockMovementCount} stock movement(s)</li>}
                  {deleteBlockers.orderLineCount > 0 && <li>{deleteBlockers.orderLineCount} order line(s)</li>}
                  {deleteBlockers.reservationCount > 0 && <li>{deleteBlockers.reservationCount} reservation(s)</li>}
                  {deleteBlockers.transferCount > 0 && <li>{deleteBlockers.transferCount} transfer(s)</li>}
                  {deleteBlockers.poLineCount > 0 && <li>{deleteBlockers.poLineCount} purchase order line(s)</li>}
                </ul>
                <p className="text-sm text-brand-charcoal">
                  You can archive it instead — it&apos;s removed from the storefront immediately, and every bit of
                  that history stays intact.
                </p>

                {deleteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}

                <div className="flex gap-3">
                  <Button onClick={confirmArchive} disabled={deleting}>
                    {deleting ? "Archiving…" : "Archive Instead"}
                  </Button>
                  <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-brand-charcoal">
                  <span className="font-semibold">{pendingDelete.name}</span> will be permanently deleted from the
                  database, including all of its variants. This can&apos;t be undone.
                </p>
                <p className="text-sm text-brand-charcoal/70">
                  If it has any stock, order, reservation, transfer, or purchase-order history, this will be blocked
                  and you&apos;ll be offered to archive it instead — archiving removes it from the storefront without
                  deleting anything.
                </p>

                {deleteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}

                <div className="flex gap-3">
                  <Button icon={Trash2} onClick={confirmDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : "Delete Permanently"}
                  </Button>
                  <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <RequireAuth permission="catalog:read">
      <ProductsContent />
    </RequireAuth>
  );
}
