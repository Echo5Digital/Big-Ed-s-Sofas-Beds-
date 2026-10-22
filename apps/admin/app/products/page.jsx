"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlusCircle, Search } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
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
      const matchesCategory = !categoryId || r.product.category?.id === categoryId;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryId]);

  const columns = [
    { key: "sku", header: "SKU", render: (r) => r.variant.sku },
    { key: "name", header: "Product", render: (r) => r.product.name },
    { key: "category", header: "Category", render: (r) => r.product.category?.name ?? "—" },
    { key: "price", header: "Price", render: (r) => formatCentsAsCurrency(r.variant.priceCents) },
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
      key: "actions",
      header: "",
      render: (r) => (
        <Link href={`/products/${r.product.id}`} className="font-semibold text-brand-red hover:text-brand-red-dark">
          Edit
        </Link>
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
        rows={products === null ? null : rows}
        emptyMessage={
          products !== null && products.length > 0
            ? "No products match your search or filter."
            : "No products yet. Create your first product to get started."
        }
      />
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
