"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ApiClientError } from "@/lib/api/client";

// Form building blocks shared by the sign-in panel and the signed-in account
// sections, so every account form looks and behaves the same.

export const inputClass =
  "w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red disabled:bg-brand-charcoal/5 disabled:text-brand-charcoal/60";
export const primaryButtonClass =
  "mt-2 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButtonClass =
  "rounded-full border border-brand-charcoal/20 px-6 py-2.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:opacity-60";
export const smallPrimaryButtonClass =
  "rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60";
export const linkButtonClass =
  "text-sm font-semibold text-brand-red underline-offset-2 hover:text-brand-red-dark hover:underline focus-visible:outline-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:text-brand-charcoal/40 disabled:no-underline";

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

export function Notice({ notice, className = "mt-4" }) {
  if (!notice) return null;
  const isError = notice.type === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`${className} rounded-lg px-4 py-3 text-sm ${
        isError ? "bg-brand-red/10 text-brand-red-dark" : "bg-brand-gold/15 text-brand-charcoal/80"
      }`}
    >
      {notice.message}
    </p>
  );
}

export function Field({ id, label, onChange, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
        {label}
      </label>
      <input id={id} onChange={(event) => onChange(event.target.value)} className={inputClass} {...inputProps} />
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, autoComplete, hint, minLength }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-brand-charcoal/60 hover:text-brand-charcoal focus-visible:outline-2 focus-visible:outline-brand-red"
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs text-brand-charcoal/60">{hint}</p> : null}
    </div>
  );
}
