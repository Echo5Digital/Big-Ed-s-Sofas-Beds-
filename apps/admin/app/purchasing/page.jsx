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
  const [tab, setTab] = useState("ACTIVE"); // "ACTIVE" | "COMPLETED"
  // Keyed by tab so DataTable shows its loading state (rows=null) rather than
  // the other tab's rows while a switch is in flight — set only from the
  // request's own .then/.catch, never synchronously in the effect body.
  const [purchaseOrdersByTab, setPurchaseOrdersByTab] = useState({ ACTIVE: null, COMPLETED: null });
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/purchasing/purchase-orders?status=${tab}`)
      .then((data) => setPurchaseOrdersByTab((prev) => ({ ...prev, [tab]: data.purchaseOrders })))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load purchase orders."));
  }, [tab]);

  const purchaseOrders = purchaseOrdersByTab[tab];

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

      <div className="mb-4 inline-flex rounded-lg border border-black/15 p-0.5 text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab("ACTIVE")}
          className={`rounded-md px-3 py-1 transition-colors ${
            tab === "ACTIVE" ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-black/5"
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setTab("COMPLETED")}
          className={`rounded-md px-3 py-1 transition-colors ${
            tab === "COMPLETED" ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-black/5"
          }`}
        >
          Completed
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataTable
        columns={columns}
        rows={purchaseOrders}
        rowHref={(r) => `/purchasing/${r.id}`}
        emptyMessage={tab === "ACTIVE" ? "No active purchase orders." : "No completed purchase orders yet."}
      />
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
