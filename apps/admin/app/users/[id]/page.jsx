"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import { api, ApiClientError } from "@/lib/api/client";
import { formatCentsAsCurrency } from "@/lib/formatCurrency";

const ROLE_TONE = { SALESMAN: "default", MANAGER: "info" };

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function BackToUsersLink() {
  return (
    <Link
      href="/users"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-charcoal/60 hover:text-brand-red"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to Users
    </Link>
  );
}

function UserDrilldownContent() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [attributions, setAttributions] = useState(null);
  const [approvals, setApprovals] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      api.get("/users"),
      api.get(`/users/${id}/sales-attribution`),
      api.get(`/users/${id}/discount-approvals`),
    ])
      .then(([usersData, attributionData, approvalData]) => {
        setUser(usersData.users.find((u) => u.id === id) ?? null);
        setAttributions(attributionData.attributions);
        setApprovals(approvalData.approvals);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load user activity."));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const salesColumns = [
    {
      key: "orderNumber",
      header: "Order #",
      render: (a) => (
        <Link href={`/orders/${a.orderId}`} className="font-semibold text-brand-red hover:underline">
          {a.orderNumber}
        </Link>
      ),
    },
    { key: "createdAt", header: "Date", render: (a) => formatDateTime(a.createdAt) },
    {
      key: "role",
      header: "Role",
      render: (a) => <Badge tone={ROLE_TONE[a.role] ?? "default"}>{a.role}</Badge>,
    },
    { key: "splitPercent", header: "Split", render: (a) => `${a.splitPercent}%` },
    { key: "creditedAmountCents", header: "Credited amount", render: (a) => formatCentsAsCurrency(a.creditedAmountCents) },
    { key: "totalCents", header: "Order total", render: (a) => formatCentsAsCurrency(a.totalCents) },
  ];

  const approvalColumns = [
    {
      key: "orderNumber",
      header: "Order #",
      render: (o) => (
        <Link href={`/orders/${o.id}`} className="font-semibold text-brand-red hover:underline">
          {o.orderNumber}
        </Link>
      ),
    },
    { key: "createdAt", header: "Date", render: (o) => formatDateTime(o.createdAt) },
    { key: "discountPercent", header: "Discount %", render: (o) => (o.discountPercent != null ? `${o.discountPercent}%` : "—") },
    { key: "discountCents", header: "Discount amount", render: (o) => formatCentsAsCurrency(o.discountCents) },
    { key: "subtotalCents", header: "Subtotal", render: (o) => formatCentsAsCurrency(o.subtotalCents) },
  ];

  return (
    <div>
      <BackToUsersLink />

      <PageHeader
        title={user ? `${user.firstName} ${user.lastName}` : "User"}
        subtitle={user?.employeeId ? `Employee ID: ${user.employeeId}` : undefined}
        action={
          user && (
            <div className="flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <Badge
                  key={role}
                  tone={
                    role === "SUPER_ADMIN" || role === "ADMIN"
                      ? "danger"
                      : role === "MANAGER"
                        ? "info"
                        : role === "CASHIER"
                          ? "success"
                          : "default"
                  }
                >
                  {role}
                </Badge>
              ))}
            </div>
          )
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <h2 className="mb-3 mt-2 text-sm font-semibold uppercase tracking-wide text-brand-charcoal/50">Sales credited</h2>
      <DataTable columns={salesColumns} rows={attributions} emptyMessage="No sales credited to this user yet." />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-brand-charcoal/50">
        Discounts approved via PIN
      </h2>
      <DataTable columns={approvalColumns} rows={approvals} emptyMessage="This user hasn't approved any discount overrides." />
    </div>
  );
}

export default function UserDrilldownPage() {
  return (
    <RequireAuth permission="users:manage">
      <UserDrilldownContent />
    </RequireAuth>
  );
}
