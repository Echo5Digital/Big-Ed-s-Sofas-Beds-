"use client";

import { useEffect, useId, useState } from "react";
import { Pencil, Mail, Phone, User, CalendarDays } from "lucide-react";
import { getProfile, updateProfile, isSessionExpired } from "@/lib/api/customerAccount";
import {
  Field,
  Notice,
  describeError,
  linkButtonClass,
  secondaryButtonClass,
  smallPrimaryButtonClass,
} from "@/components/account/formParts";

function formatMemberSince(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function Detail({ label, icon: Icon, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-charcoal/10 bg-brand-cream/40 p-4">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-charcoal/40">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold text-brand-charcoal">{children}</dd>
      </div>
    </div>
  );
}

export default function ProfileSection({ onSessionExpired, onProfileSaved }) {
  const uid = useId();
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const setField = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isSessionExpired(error)) onSessionExpired();
        else setLoadError(describeError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, onSessionExpired]);

  function startEditing() {
    setForm({ firstName: profile.firstName ?? "", lastName: profile.lastName ?? "", phone: profile.phone ?? "" });
    setNotice(null);
    setEditing(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const saved = await updateProfile(form);
      setProfile(saved);
      onProfileSaved({ firstName: saved.firstName, lastName: saved.lastName });
      setEditing(false);
      setNotice({ type: "success", message: "Your details have been updated." });
    } catch (error) {
      if (isSessionExpired(error)) onSessionExpired();
      else setNotice({ type: "error", message: describeError(error) });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <Notice notice={{ type: "error", message: loadError }} className="" />
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setReloadKey((key) => key + 1);
          }}
          className={`${linkButtonClass} mt-3`}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <p role="status" aria-busy="true" className="text-sm text-brand-charcoal/60">
        Loading&hellip;
      </p>
    );
  }

  const memberSince = formatMemberSince(profile.memberSince);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-lg font-bold text-brand-charcoal">Personal Information</h3>
        {!editing ? (
          <button
            type="button"
            onClick={startEditing}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand-charcoal/15 px-3.5 py-1.5 text-sm font-semibold text-brand-charcoal transition-colors hover:border-brand-red/30 hover:bg-brand-red/5 hover:text-brand-red focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>

      <Notice notice={notice} className="mt-4" />

      {editing ? (
        <form onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id={`${uid}-first`}
              label="First Name"
              autoComplete="given-name"
              required
              maxLength={100}
              value={form.firstName}
              onChange={setField("firstName")}
            />
            <Field
              id={`${uid}-last`}
              label="Last Name"
              autoComplete="family-name"
              required
              maxLength={100}
              value={form.lastName}
              onChange={setField("lastName")}
            />
          </div>
          <div>
            <Field
              id={`${uid}-email`}
              label="Email Address"
              type="email"
              value={profile.email ?? ""}
              onChange={() => {}}
              disabled
              aria-describedby={`${uid}-email-hint`}
            />
            <p id={`${uid}-email-hint`} className="mt-1 text-xs text-brand-charcoal/60">
              This is the email you sign in with, so it can&apos;t be changed here.
            </p>
          </div>
          <Field
            id={`${uid}-phone`}
            label="Phone Number"
            type="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            maxLength={40}
            value={form.phone}
            onChange={setField("phone")}
          />
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={busy} className={smallPrimaryButtonClass}>
              {busy ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="First Name" icon={User}>
            {profile.firstName || "—"}
          </Detail>
          <Detail label="Last Name" icon={User}>
            {profile.lastName || "—"}
          </Detail>
          <Detail label="Email Address" icon={Mail}>
            {profile.email}
          </Detail>
          <Detail label="Phone Number" icon={Phone}>
            {profile.phone || "Not added"}
          </Detail>
          {memberSince ? (
            <Detail label="Member Since" icon={CalendarDays}>
              {memberSince}
            </Detail>
          ) : null}
        </dl>
      )}
    </div>
  );
}
