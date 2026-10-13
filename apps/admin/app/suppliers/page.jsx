"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusCircle } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError } from "@/lib/api/client";

function NewSupplierModal({ open, onClose, onDone }) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/purchasing/suppliers", {
        name,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create supplier.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Supplier">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Supplier name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Contact name</label>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Lead time (days)</label>
          <input
            type="number"
            min="0"
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Create Supplier"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    api
      .get("/purchasing/suppliers")
      .then((data) => setSuppliers(data.suppliers))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load suppliers."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    { key: "name", header: "Supplier" },
    { key: "contactName", header: "Contact", render: (s) => s.contactName ?? "—" },
    { key: "email", header: "Email", render: (s) => s.email ?? "—" },
    { key: "phone", header: "Phone", render: (s) => s.phone ?? "—" },
    { key: "leadTimeDays", header: "Lead time", render: (s) => (s.leadTimeDays ? `${s.leadTimeDays} days` : "—") },
  ];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Vendor profiles and lead times"
        action={
          <Button icon={PlusCircle} onClick={() => setModalOpen(true)}>
            New Supplier
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataTable columns={columns} rows={suppliers} emptyMessage="No suppliers yet." />

      <NewSupplierModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <RequireAuth>
      <SuppliersContent />
    </RequireAuth>
  );
}
