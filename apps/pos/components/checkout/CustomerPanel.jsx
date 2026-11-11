"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { User, Search, X, UserPlus } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

function NewCustomerForm({ onCreated, onCancel }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const hasAddressInput = Boolean(line1 || city || state || postalCode);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post("/pos/customers", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: hasAddressInput
          ? { line1: line1.trim(), city: city.trim(), state: state.trim(), postalCode: postalCode.trim() }
          : undefined,
      });
      onCreated(data.customer);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
        <input
          required
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
      </div>
      <input
        required
        placeholder="Phone number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
      <p className="text-xs font-medium text-brand-charcoal/40">Address (optional)</p>
      <input
        placeholder="Street address"
        value={line1}
        onChange={(e) => setLine1(e.target.value)}
        className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
        <input
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
        <input
          placeholder="ZIP"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? "Saving…" : "Save customer"}
        </Button>
      </div>
    </form>
  );
}

export default function CustomerPanel({ customer, onSelect, onRemove }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const data = await api.get(`/pos/customers/search?q=${encodeURIComponent(q)}`);
      if (requestId !== requestIdRef.current) return;
      setResults(data.customers);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 250);
    return () => clearTimeout(timeout);
  }, [query, search]);

  function handlePick(c) {
    onSelect(c);
    setSearchOpen(false);
    setQuery("");
    setResults([]);
  }

  function handleCreated(c) {
    onSelect(c);
    setNewCustomerOpen(false);
    setSearchOpen(false);
  }

  if (customer) {
    return (
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-brand-cream/70 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <User className="size-4 shrink-0 text-brand-charcoal/50" aria-hidden="true" />
          <span className="truncate font-semibold text-brand-charcoal">
            {customer.firstName} {customer.lastName}
          </span>
          {customer.phone && <span className="shrink-0 text-xs text-brand-charcoal/50">{customer.phone}</span>}
        </span>
        <button
          type="button"
          aria-label="Remove customer"
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-brand-charcoal/40 hover:bg-red-50 hover:text-red-600"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 flex gap-2">
      <Button type="button" variant="outline" size="sm" icon={Search} onClick={() => setSearchOpen(true)} className="flex-1">
        Find customer
      </Button>
      <Button type="button" variant="outline" size="sm" icon={UserPlus} onClick={() => setNewCustomerOpen(true)} className="flex-1">
        New customer
      </Button>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Find customer">
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Search by name, phone, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-3 text-base focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
          />
          {loading && <p className="text-sm text-brand-charcoal/50">Searching…</p>}
          {!loading && query.trim() && results.length === 0 && (
            <p className="text-sm text-brand-charcoal/50">No matching customers.</p>
          )}
          <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handlePick(c)}
                  className="flex w-full flex-col gap-0.5 rounded-lg border border-black/10 px-3 py-2.5 text-left hover:border-black/20 hover:bg-brand-cream/40"
                >
                  <span className="text-sm font-semibold text-brand-charcoal">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="text-xs text-brand-charcoal/50">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      <Modal open={newCustomerOpen} onClose={() => setNewCustomerOpen(false)} title="New customer">
        <NewCustomerForm onCreated={handleCreated} onCancel={() => setNewCustomerOpen(false)} />
      </Modal>
    </div>
  );
}
