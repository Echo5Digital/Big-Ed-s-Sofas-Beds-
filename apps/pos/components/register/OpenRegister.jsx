"use client";

import { useState, useEffect, useCallback } from "react";
import { DoorOpen, LockOpen } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import Card from "../ui/Card";
import Button from "../ui/Button";
import CloseRegister from "./CloseRegister";

export default function OpenRegister() {
  const { openSession } = useRegisterSession();
  const [registers, setRegisters] = useState([]);
  const [registerId, setRegisterId] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [closingRegister, setClosingRegister] = useState(null);

  const loadRegisters = useCallback(() => {
    return api
      .get("/pos/registers")
      .then((data) => {
        setRegisters(data.registers);
        setRegisterId((current) => {
          if (current && data.registers.some((r) => r.id === current)) return current;
          return data.registers[0]?.id ?? "";
        });
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load registers"))
      .finally(() => setLoading(false));
  }, []);

  // Initial mount only — loading starts true via useState below, so there's
  // no synchronous setState here. handleClosedStuckRegister() below re-calls
  // loadRegisters() directly (not through this effect) to silently refresh
  // the list after closing a stuck register, without flashing the
  // full-page "Loading registers…" state again.
  useEffect(() => {
    loadRegisters();
  }, [loadRegisters]);

  const selectedRegister = registers.find((r) => r.id === registerId);

  function handleCloseStuckRegister() {
    if (!selectedRegister?.openSessionId) return;
    setError(null);
    setClosingRegister(selectedRegister);
  }

  function handleClosedStuckRegister() {
    setClosingRegister(null);
    loadRegisters();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const register = registers.find((r) => r.id === registerId);
    if (register?.openSessionId) {
      setError("This register already has an open session on another device.");
      return;
    }

    setSubmitting(true);
    try {
      const openingCashCents = Math.round(Number(openingCash || 0) * 100);
      const data = await api.post("/pos/registers/open", { registerId, openingCashCents });
      openSession({ ...data.session, registerName: register?.name });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to open register");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-brand-cream/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold-dark">
            <DoorOpen className="size-7" aria-hidden="true" />
          </span>
          <h1 className="font-display text-lg font-bold text-brand-charcoal">Open your register</h1>
          <p className="text-sm text-brand-charcoal/60">Count the starting cash drawer before your first sale.</p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-brand-charcoal/60">Loading registers…</p>
        ) : registers.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No active registers are configured. Ask a manager to create one in the admin dashboard.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register" className="text-sm font-medium text-brand-charcoal">
                Register
              </label>
              <select
                id="register"
                value={registerId}
                onChange={(e) => setRegisterId(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
              >
                {registers.map((r) => (
                  <option key={r.id} value={r.id} disabled={Boolean(r.openSessionId)}>
                    {r.name} {r.locationName ? `— ${r.locationName}` : ""} {r.openSessionId ? "(in use)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedRegister?.openSessionId && (
              <div className="flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <p>
                  This register is already open on another device or was never closed out from a previous shift.
                  Close it before opening a new session.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={LockOpen}
                  onClick={handleCloseStuckRegister}
                  className="self-start"
                >
                  Close this register
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="openingCash" className="text-sm font-medium text-brand-charcoal">
                Opening cash ($)
              </label>
              <input
                id="openingCash"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-3 text-base transition-shadow focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || Boolean(selectedRegister?.openSessionId)}
              className="w-full"
            >
              {submitting ? "Opening…" : "Open register"}
            </Button>
          </form>
        )}

        <CloseRegister
          open={Boolean(closingRegister)}
          onClose={() => setClosingRegister(null)}
          registerSessionId={closingRegister?.openSessionId}
          registerName={closingRegister?.name}
          onClosed={handleClosedStuckRegister}
        />
      </Card>
    </div>
  );
}
