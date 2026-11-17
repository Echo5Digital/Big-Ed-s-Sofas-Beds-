"use client";

import { useEffect, useState } from "react";
import { UserCheck, Plus, X, Search, Check } from "lucide-react";
import { api } from "@/lib/api/client";

function roleForStaff(staffMember) {
  if (!staffMember) return "SALESMAN";
  if (staffMember.roles.includes("MANAGER")) return "MANAGER";
  if (staffMember.roles.includes("SALESMAN")) return "SALESMAN";
  return staffMember.roles[0] ?? "SALESMAN";
}

// One "Sold by" row: the cashier types a staff member's employee ID badge
// number (e.g. "SLS001"); matching it against the already-fetched staff
// roster links the sale to that user's id and role, same as scanning a
// badge. This is purely an attribution link, not a staff directory — no
// name is ever shown here (deliberate: the ID field is the only identity
// surface). A resolved match is confirmed with a checkmark + green border
// on the input itself, nothing else. Falls back to an ID-only
// disambiguation list when the typed text matches more than one employee
// ID prefix.
function AttributionRow({ entry, staff, onChange, onRemove, showPercent }) {
  const [query, setQuery] = useState(entry.employeeId ?? "");
  const [notFound, setNotFound] = useState(false);

  const resolved = staff.find((s) => s.id === entry.userId);

  function handleQueryChange(value) {
    setQuery(value);
    setNotFound(false);
    if (!value.trim()) return;
    const match = staff.find((s) => s.employeeId && s.employeeId.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      onChange({ userId: match.id, employeeId: match.employeeId, role: roleForStaff(match) });
    } else {
      setNotFound(true);
    }
  }

  const matches =
    query.trim() && !resolved
      ? staff.filter((s) => s.employeeId?.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
      : [];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-brand-charcoal/35" aria-hidden="true" />
          <input
            type="text"
            placeholder="Employee ID (e.g. SLS001)"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            aria-label="Employee ID"
            className={`w-full rounded-lg border py-2 pl-8 pr-8 text-sm uppercase focus:outline-none focus:ring-2 ${
              resolved
                ? "border-green-500 focus:border-green-500 focus:ring-green-500/20"
                : "border-black/15 focus:border-brand-red focus:ring-brand-red/20"
            }`}
          />
          {resolved && (
            <Check
              className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-green-600"
              aria-hidden="true"
            />
          )}
        </div>

        {showPercent && (
          <>
            <input
              type="number"
              min="1"
              max="100"
              inputMode="numeric"
              value={entry.percent}
              onChange={(e) => onChange({ ...entry, percent: Number(e.target.value) })}
              className="w-16 rounded-lg border border-black/15 px-2 py-2 text-sm tabular-nums focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
            <span className="text-sm text-brand-charcoal/50">%</span>
          </>
        )}

        {onRemove && (
          <button
            type="button"
            aria-label="Remove staff member"
            onClick={onRemove}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-brand-charcoal/40 hover:bg-red-50 hover:text-red-600"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {matches.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-black/10 bg-white p-1">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery(s.employeeId);
                  onChange({ userId: s.id, employeeId: s.employeeId, role: roleForStaff(s) });
                }}
                className="w-full rounded-md px-2 py-1 text-left font-mono text-xs font-semibold hover:bg-brand-cream/60"
              >
                {s.employeeId}
              </button>
            </li>
          ))}
        </ul>
      ) : notFound ? (
        <p className="text-xs font-medium text-red-600">No staff member with that employee ID.</p>
      ) : null}
    </div>
  );
}

// Who gets credit for this sale — 1-2 staff members, defaulting to the
// logged-in cashier at 100%. Lives outside TenderModal: attribution is a
// property of the sale itself, independent of how it's eventually tendered,
// so a cashier can set it up while still browsing the cart.
export default function AttributionPanel({ attribution, onChange }) {
  const [staff, setStaff] = useState([]);

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

  function updateEntry(index, nextEntry) {
    const next = attribution.map((entry, i) => (i === index ? nextEntry : entry));
    onChange(next);
  }

  function handleAddSecond() {
    onChange([{ ...attribution[0], percent: 50 }, { userId: "", employeeId: "", role: "SALESMAN", percent: 50 }]);
  }

  function handleRemoveSecond() {
    onChange([{ ...attribution[0], percent: 100 }]);
  }

  const splitTotal = attribution.reduce((sum, e) => sum + (Number(e.percent) || 0), 0);
  const splitInvalid = attribution.length === 2 && splitTotal !== 100;

  return (
    <div className="mb-3 rounded-lg bg-brand-cream/70 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">
        <UserCheck className="size-3.5" aria-hidden="true" />
        Sold by
      </p>

      <div className="flex flex-col gap-3">
        {attribution.map((entry, index) => (
          <AttributionRow
            key={index}
            entry={entry}
            staff={staff}
            showPercent={attribution.length === 2}
            onChange={(nextEntry) => updateEntry(index, nextEntry)}
            onRemove={index === 1 ? handleRemoveSecond : undefined}
          />
        ))}

        {attribution.length === 1 && (
          <button
            type="button"
            onClick={handleAddSecond}
            className="flex items-center gap-1.5 self-start text-xs font-semibold text-brand-charcoal/60 hover:text-brand-red"
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
