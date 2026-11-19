"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ApiClientError } from "@/lib/api/client";

// Form building blocks shared by the sign-in panel and the signed-in account
// sections, so every account form looks and behaves the same.

export const inputClass =
  "w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 transition-shadow focus:outline-none focus-visible:border-brand-red/40 focus-visible:shadow-[0_0_0_4px_rgba(179,8,19,0.1)] focus-visible:outline-none disabled:bg-brand-charcoal/5 disabled:text-brand-charcoal/60";
// Same as inputClass but with left padding cleared for an icon prefix
// (Field/PasswordField's optional `icon` prop) — kept as its own export
// rather than a runtime string-replace so both variants stay static,
// statically-analyzable Tailwind classes.
export const inputWithIconClass =
  "w-full rounded-lg border border-brand-charcoal/20 bg-brand-charcoal/[0.03] py-2.5 pr-3.5 pl-10 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 transition-shadow focus:outline-none focus-visible:border-brand-red/40 focus-visible:bg-white focus-visible:shadow-[0_0_0_4px_rgba(179,8,19,0.1)] focus-visible:outline-none disabled:bg-brand-charcoal/5 disabled:text-brand-charcoal/60";
// Frosted variant for AccountPanel's glass card (AccountHero's signed-out
// view only) — white-on-white would otherwise be unreadable on a
// translucent surface, so these swap to a light, semi-transparent fill with
// white text/placeholder instead of the solid-card's charcoal.
export const inputGlassClass =
  "w-full rounded-lg border border-white/30 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/50 backdrop-blur-sm transition-shadow focus:outline-none focus-visible:border-white/60 focus-visible:bg-white/20 focus-visible:shadow-[0_0_0_4px_rgba(255,255,255,0.15)] focus-visible:outline-none disabled:bg-white/5 disabled:text-white/50";
export const inputGlassWithIconClass =
  "w-full rounded-lg border border-white/30 bg-white/10 py-2.5 pr-3.5 pl-10 text-sm text-white placeholder:text-white/50 backdrop-blur-sm transition-shadow focus:outline-none focus-visible:border-white/60 focus-visible:bg-white/20 focus-visible:shadow-[0_0_0_4px_rgba(255,255,255,0.15)] focus-visible:outline-none disabled:bg-white/5 disabled:text-white/50";
export const primaryButtonClass =
  "mt-2 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-red-dark hover:shadow-lg hover:shadow-brand-red/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";
export const secondaryButtonClass =
  "rounded-full border border-brand-charcoal/20 px-6 py-2.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:opacity-60";
export const smallPrimaryButtonClass =
  "rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60";
export const linkButtonClass =
  "-my-2 inline-block py-2 text-sm font-semibold text-brand-red underline-offset-2 hover:text-brand-red-dark hover:underline focus-visible:outline-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:text-brand-charcoal/40 disabled:no-underline";

export function reasonOf(error) {
  return error instanceof ApiClientError ? error.details?.reason : undefined;
}

// Turns whatever went wrong into one sentence for the customer. The API's
// validation failures (422) carry per-field messages; everything else the API
// raises already has a customer-readable message.
export function describeError(error) {
  if (error instanceof ApiClientError) {
    if (error.status === 422 && error.details?.fieldErrors) {
      const first = Object.values(error.details.fieldErrors).flat()[0];
      if (first) return first;
      const formError = error.details.formErrors?.[0];
      if (formError) return formError;
    }
    return error.message;
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

export function Notice({ notice, className = "mt-4", glass = false }) {
  if (!notice) return null;
  const isError = notice.type === "error";
  const tone = glass
    ? isError
      ? "border border-red-300/40 bg-red-500/20 text-white"
      : "border border-white/30 bg-white/15 text-white"
    : isError
      ? "bg-brand-red/10 text-brand-red-dark"
      : "bg-brand-gold/15 text-brand-charcoal/80";
  return (
    <p role={isError ? "alert" : "status"} className={`${className} rounded-lg px-4 py-3 text-sm ${tone}`}>
      {notice.message}
    </p>
  );
}

export function Field({ id, label, onChange, icon: Icon, glass = false, ...inputProps }) {
  const iconColor = glass ? "text-white/60" : "text-brand-charcoal/40";
  return (
    <div>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-semibold ${glass ? "text-white/90" : "text-brand-charcoal"}`}>
        {label}
      </label>
      <div className="relative">
        {Icon ? <Icon className={`pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 ${iconColor}`} aria-hidden="true" /> : null}
        <input
          id={id}
          onChange={(event) => onChange(event.target.value)}
          className={glass ? (Icon ? inputGlassWithIconClass : inputGlassClass) : Icon ? inputWithIconClass : inputClass}
          {...inputProps}
        />
      </div>
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, autoComplete, hint, minLength, icon: Icon, glass = false }) {
  const [visible, setVisible] = useState(false);
  const VisibilityIcon = visible ? EyeOff : Eye;
  const iconColor = glass ? "text-white/60" : "text-brand-charcoal/40";
  return (
    <div>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-semibold ${glass ? "text-white/90" : "text-brand-charcoal"}`}>
        {label}
      </label>
      <div className="relative">
        {Icon ? <Icon className={`pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 ${iconColor}`} aria-hidden="true" /> : null}
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className={`${glass ? (Icon ? inputGlassWithIconClass : inputGlassClass) : Icon ? inputWithIconClass : inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-brand-red ${
            glass ? "text-white/60 hover:text-white" : "text-brand-charcoal/60 hover:text-brand-charcoal"
          }`}
        >
          <VisibilityIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
      {hint ? <p className={`mt-1 text-xs ${glass ? "text-white/60" : "text-brand-charcoal/60"}`}>{hint}</p> : null}
    </div>
  );
}
