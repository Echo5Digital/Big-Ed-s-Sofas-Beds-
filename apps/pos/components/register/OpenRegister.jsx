"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { DoorOpen, ShieldAlert, CalendarDays, Hourglass } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import Card from "../ui/Card";
import Button from "../ui/Button";

// How often to re-check a register pending manager approval. Fast enough
// that a cashier isn't stuck staring at a stale "waiting" screen for long
// after a manager approves, slow enough not to hammer the API from an idle tab.
const PENDING_REOPEN_POLL_MS = 5000;

export default function OpenRegister() {
  const { openSession } = useRegisterSession();
  const [registers, setRegisters] = useState([]);
  const [registerId, setRegisterId] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestingReopen, setRequestingReopen] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

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
  // no synchronous setState here. Pending-reopen polling below re-calls
  // loadRegisters() directly (not through this effect) to silently refresh
  // the list once a manager approves/denies, without flashing the full-page
  // "Loading registers…" state again.
  useEffect(() => {
    loadRegisters();
  }, [loadRegisters]);

  const selectedRegister = registers.find((r) => r.id === registerId);

  const today = useMemo(() => new Date(), []);
  const todayLabel = useMemo(
    () => today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    [today]
  );
  const weekdayLabel = useMemo(() => today.toLocaleDateString("en-US", { weekday: "long" }), [today]);
  const isRegisterOpen = Boolean(selectedRegister?.openSessionId);
  const isPendingReopen = Boolean(selectedRegister?.pendingReopenSessionId);

  // While the selected register is awaiting manager approval, poll in the
  // background so the cashier's "waiting" screen clears itself the moment an
  // admin approves or denies — no manual refresh needed.
  useEffect(() => {
    if (!isPendingReopen) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(loadRegisters, PENDING_REOPEN_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [isPendingReopen, loadRegisters]);

  async function handleRequestReopen() {
    if (!selectedRegister?.openSessionId) return;
    setError(null);
    setRequestingReopen(true);
    try {
      await api.post(`/pos/sessions/${selectedRegister.openSessionId}/request-reopen`);
      await loadRegisters();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to request reopen approval");
    } finally {
      setRequestingReopen(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const register = registers.find((r) => r.id === registerId);
    if (register?.openSessionId) {
      setError("This register already has an open session on another device.");
      return;
    }
    if (register?.pendingReopenSessionId) {
      setError("This register is awaiting manager approval to reopen.");
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

        {!loading && registers.length > 0 && (
          <div className="mb-4 rounded-xl bg-brand-cream/50 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-charcoal/50">
              Today&apos;s register
            </p>
            <div className="mt-1 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 shrink-0 text-brand-red">
                  <CalendarDays className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-charcoal">{todayLabel}</p>
                  <p className="truncate text-xs text-brand-charcoal/60">
                    {weekdayLabel}
                    {selectedRegister?.locationName ? ` · ${selectedRegister.locationName}` : ""}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isPendingReopen
                    ? "bg-amber-100 text-amber-700"
                    : isRegisterOpen
                      ? "bg-green-100 text-green-700"
                      : "bg-brand-red/10 text-brand-red"
                }`}
              >
                {isPendingReopen ? "Pending approval" : isRegisterOpen ? "Open" : "Closed"}
              </span>
            </div>
          </div>
        )}

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
                  <option key={r.id} value={r.id} disabled={Boolean(r.openSessionId || r.pendingReopenSessionId)}>
                    {r.name} {r.locationName ? `— ${r.locationName}` : ""}{" "}
                    {r.pendingReopenSessionId ? "(pending approval)" : r.openSessionId ? "(in use)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {isPendingReopen && (
              <div className="flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>
                    This register wasn&apos;t closed out properly last shift. A request has been sent to management
                    — it&apos;ll unlock automatically once a manager or admin approves it.
                  </p>
                </div>
              </div>
            )}

            {selectedRegister?.openSessionId && !isPendingReopen && (
              <div className="flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <p>
                  This register is already open on another device or was never closed out from a previous shift.
                  Request approval to reopen it before starting a new session.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={ShieldAlert}
                  onClick={handleRequestReopen}
                  disabled={requestingReopen}
                  className="self-start"
                >
                  {requestingReopen ? "Requesting…" : "Request reopen approval"}
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
              disabled={submitting || isRegisterOpen || isPendingReopen}
              className="w-full"
            >
              {submitting ? "Opening…" : "Open register"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
