"use client";

import { useEffect, useState } from "react";
import { UserCheck, Plus, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/useAuth";

const ROLE_LABEL = { SALESMAN: "Salesman", MANAGER: "Manager" };

// Who gets credit for this sale — 1-2 staff members, defaulting to the
// logged-in cashier at 100%. Lives outside TenderModal: attribution is a
// property of the sale itself, independent of how it's eventually tendered,
// so a cashier can set it up while still browsing the cart.
export default function AttributionPanel({ attribution, onChange }) {
  const { user: currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/pos/staff")
      .then((data) => {
        if (!cancelled) setStaff(data.staff);
      })
      .catch(() => {
        // Non-fatal: the picker just shows no staff options beyond the
        // default self-attribution already set by the parent.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateEntry(index, patch) {
    const next = attribution.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    onChange(next);
  }

  function handleAddSecond() {
    const firstId = attribution[0]?.userId;
    const second = staff.find((s) => s.id !== firstId);
    if (!second) return;
    onChange([
      { ...attribution[0], percent: 50 },
      { userId: second.id, role: "SALESMAN", percent: 50 },
    ]);
    setAdding(false);
  }

  function handleRemoveSecond() {
    onChange([{ ...attribution[0], percent: 100 }]);
  }

  const splitTotal = attribution.reduce((sum, e) => sum + (Number(e.percent) || 0), 0);
  const splitInvalid = attribution.length === 2 && splitTotal !== 100;

  function staffName(userId) {
    if (userId === currentUser?.id) return `${currentUser.firstName} ${currentUser.lastName} (you)`;
    const match = staff.find((s) => s.id === userId);
    return match ? `${match.firstName} ${match.lastName}` : "Unknown";
  }

  return (
    <div className="mb-3 rounded-lg bg-brand-cream/70 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
        <UserCheck className="size-3.5" aria-hidden="true" />
        Sold by
      </p>

      <div className="flex flex-col gap-2">
        {attribution.map((entry, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={entry.userId}
              onChange={(e) => updateEntry(index, { userId: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-black/15 px-2.5 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            >
              {!staff.some((s) => s.id === entry.userId) && <option value={entry.userId}>{staffName(entry.userId)}</option>}
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                  {s.id === currentUser?.id ? " (you)" : ""}
                </option>
              ))}
            </select>

            <select
              value={entry.role}
              onChange={(e) => updateEntry(index, { role: e.target.value })}
              className="rounded-lg border border-black/15 px-2.5 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            >
              {Object.entries(ROLE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {attribution.length === 2 && (
              <>
                <input
                  type="number"
                  min="1"
                  max="100"
                  inputMode="numeric"
                  value={entry.percent}
                  onChange={(e) => updateEntry(index, { percent: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-black/15 px-2 py-2 text-sm tabular-nums focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                />
                <span className="text-sm text-brand-charcoal/50">%</span>
              </>
            )}

            {index === 1 && (
              <button
                type="button"
                aria-label="Remove second staff member"
                onClick={handleRemoveSecond}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-brand-charcoal/40 hover:bg-red-50 hover:text-red-600"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}

        {attribution.length === 1 && (
          <button
            type="button"
            onClick={handleAddSecond}
            disabled={staff.length <= 1}
            className="flex items-center gap-1.5 self-start text-xs font-semibold text-brand-charcoal/60 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add second staff member
          </button>
        )}

        {splitInvalid && (
          <p role="alert" className="text-xs font-medium text-red-600">
            Split percentages must add up to 100 (currently {splitTotal}).
          </p>
        )}
      </div>
    </div>
  );
}
