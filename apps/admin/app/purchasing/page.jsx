"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/useAuth";

const STATUS_TONE = {
  DRAFT: "default",
  AWAITING_APPROVAL: "warning",
  APPROVED: "info",
  SENT_TO_VENDOR: "info",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELED: "danger",
};

const STATUS_LABEL = {
  DRAFT: "Draft",
  AWAITING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  SENT_TO_VENDOR: "Sent to vendor",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CANCELED: "Canceled",
};

function PurchasingContent() {
  const { hasPermission } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/purchasing/purchase-orders")
      .then((data) => setPurchaseOrders(data.purchaseOrders))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load purchase orders."));
  }, []);

  const columns = [
    {
      key: "poNumber",
      header: "PO Number",
      render: (r) => (
        <Link href={`/purchasing/${r.id}`} className="font-semibold text-brand-red hover:text-brand-red-dark">
          {r.poNumber}
        </Link>
      ),
    },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name ?? "—" },
    {
      key: "expectedDate",
      header: "Expected",
      render: (r) => (r.expectedDate ? new Date(r.expectedDate).toLocaleDateString() : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Suppliers, approvals, and receiving"
        action={
          hasPermission("purchasing:write") && (
            <Link
              href="/purchasing/new"
              className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
            >
              <PlusCircle className="size-4" aria-hidden="true" />
              Create New PO
            </Link>
          )
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataTable columns={columns} rows={purchaseOrders} emptyMessage="No purchase orders yet." />
    </div>
  );
}

export default function PurchasingPage() {
  return (
    <RequireAuth permission="purchasing:read">
      <PurchasingContent />
    </RequireAuth>
  );
}
