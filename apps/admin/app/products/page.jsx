"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const STATUS_TONE = { ACTIVE: "success", DRAFT: "default", ARCHIVED: "warning" };

function ProductsContent() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/catalog/admin/products")
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load products."));
  }, []);

  const rows = (products ?? []).flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      product,
      variant,
    }))
  );

  const columns = [
    { key: "sku", header: "SKU", render: (r) => r.variant.sku },
    { key: "name", header: "Product", render: (r) => `${r.product.name} — ${r.variant.name}` },
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

      <DataTable columns={columns} rows={products === null ? null : rows} emptyMessage="No products yet. Create your first product to get started." />
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
