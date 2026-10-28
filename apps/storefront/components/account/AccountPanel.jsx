"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { User, Mail, Eye, EyeOff, LogOut } from "lucide-react";
import { ApiClientError } from "@/lib/api/client";
import {
  registerCustomer,
  verifyRegistrationCode,
  resendRegistrationCode,
  loginCustomer,
  logoutCustomer,
  getCurrentCustomer,
} from "@/lib/api/customerAuth";

const inputClass =
  "w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red";
const primaryButtonClass =
  "mt-2 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60";
const linkButtonClass =
  "text-sm font-semibold text-brand-red underline-offset-2 hover:text-brand-red-dark hover:underline focus-visible:outline-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:text-brand-charcoal/40 disabled:no-underline";

const EMPTY_FORM = { firstName: "", lastName: "", email: "", password: "", code: "" };

function reasonOf(error) {
  return error instanceof ApiClientError ? error.details?.reason : undefined;
}

// Turns whatever went wrong into one sentence for the customer. The API's
// validation failures (422) carry per-field messages; everything else the API
// raises already has a customer-readable message.
function describeError(error) {
  if (error instanceof ApiClientError) {
    if (error.status === 422 && error.details?.fieldErrors) {
      const first = Object.values(error.details.fieldErrors).flat()[0];
      if (first) return first;
    }
    return error.message;
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

function Notice({ notice }) {
  if (!notice) return null;
  const isError = notice.type === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`mt-4 rounded-lg px-4 py-3 text-sm ${
        isError ? "bg-brand-red/10 text-brand-red-dark" : "bg-brand-gold/15 text-brand-charcoal/80"
      }`}
    >
      {notice.message}
    </p>
  );
}

function Field({ id, label, onChange, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
        {label}
      </label>
      <input id={id} onChange={(event) => onChange(event.target.value)} className={inputClass} {...inputProps} />
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, hint, minLength }) {
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

export default function AccountPanel() {
  const uid = useId();
  // loading | signin | register | verify | signedin
  const [view, setView] = useState("loading");
  const [customer, setCustomer] = useState(null);
  const [pending, setPending] = useState(null); // { pendingId, email } while awaiting the emailed code
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);

  const setField = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));
  const secondsUntilResend = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    let cancelled = false;
    getCurrentCustomer()
      .then((current) => {
        if (cancelled) return;
        setCustomer(current);
        setView(current ? "signedin" : "signin");
      })
      .catch(() => {
        // Can't tell (API unreachable): show the sign-in form rather than a
        // blank card; submitting it will surface the real connection error.
        if (!cancelled) setView("signin");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Drives the "Resend code in Ns" countdown while the code screen is open.
  useEffect(() => {
    if (view !== "verify" || resendAt <= Date.now()) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view, resendAt]);

  function goTo(nextView, nextNotice = null) {
    setNotice(nextNotice);
    setView(nextView);
  }

  function startCodeScreen(result) {
    setPending({ pendingId: result.pendingId, email: result.email });
    setResendAt(Date.now() + result.resendAvailableInSeconds * 1000);
    setNow(Date.now());
    // The password has been sent and is held server-side (hashed); don't keep
    // it in browser state any longer than needed.
    setForm((current) => ({ ...current, password: "", code: "" }));
    goTo("verify", { type: "info", message: `We emailed a 6-digit code to ${result.email}. It expires in 10 minutes.` });
  }

  async function run(action) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function handleRegister(event) {
    event.preventDefault();
    return run(async () => {
      try {
        const result = await registerCustomer({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        });
        startCodeScreen(result);
      } catch (error) {
        if (reasonOf(error) === "account_exists") {
          goTo("signin", { type: "info", message: "You already have an account with that email. Sign in below." });
        } else {
          setNotice({ type: "error", message: describeError(error) });
        }
      }
    });
  }

  function handleVerify(event) {
    event.preventDefault();
    return run(async () => {
      try {
        const verified = await verifyRegistrationCode({ pendingId: pending.pendingId, code: form.code });
        setCustomer(verified);
        setPending(null);
        setForm(EMPTY_FORM);
        goTo("signedin");
      } catch (error) {
        const reason = reasonOf(error);
        if (reason === "not_found" || reason === "too_many_attempts") {
          // Nothing left to retry against: the sign-up has to be started again.
          setPending(null);
          goTo("register", { type: "error", message: describeError(error) });
        } else if (reason === "account_exists") {
          setPending(null);
          goTo("signin", { type: "info", message: "You already have an account with that email. Sign in below." });
        } else {
          setForm((current) => ({ ...current, code: reason === "invalid_code" ? "" : current.code }));
          setNotice({ type: "error", message: describeError(error) });
        }
      }
    });
  }

  function handleResend() {
    return run(async () => {
      try {
        const result = await resendRegistrationCode({ pendingId: pending.pendingId });
        setResendAt(Date.now() + result.resendAvailableInSeconds * 1000);
        setNow(Date.now());
        setForm((current) => ({ ...current, code: "" }));
        setNotice({ type: "info", message: `We sent a new code to ${pending.email}.` });
      } catch (error) {
        const reason = reasonOf(error);
        if (reason === "not_found" || reason === "too_many_resends") {
          setPending(null);
          goTo("register", { type: "error", message: describeError(error) });
        } else {
          if (reason === "cooldown") {
            setResendAt(Date.now() + (error.details?.retryAfterSeconds ?? 60) * 1000);
            setNow(Date.now());
          }
          setNotice({ type: "error", message: describeError(error) });
        }
      }
    });
  }

  function handleLogin(event) {
    event.preventDefault();
    return run(async () => {
      try {
        const signedIn = await loginCustomer({ email: form.email, password: form.password });
        setCustomer(signedIn);
        setForm(EMPTY_FORM);
        goTo("signedin");
      } catch (error) {
        setNotice({ type: "error", message: describeError(error) });
      }
    });
  }

  function handleLogout() {
    return run(async () => {
      try {
        await logoutCustomer();
        setCustomer(null);
        goTo("signin");
      } catch (error) {
        setNotice({ type: "error", message: describeError(error) });
      }
    });
  }

  const heading = {
    loading: ["Your Account", ""],
    signin: ["Sign In to Your Account", "Track orders, save favorites, and check out faster."],
    register: ["Create Your Account", "It only takes a minute. We'll email you a code to confirm your address."],
    verify: ["Check Your Email", pending ? `Enter the 6-digit code we sent to ${pending.email}.` : ""],
    signedin: [customer ? `Welcome, ${customer.firstName || "friend"}` : "Welcome", customer?.email ?? ""],
  }[view];

  const HeadingIcon = view === "verify" ? Mail : User;

  return (
    <div className="mt-6 rounded-2xl border border-brand-charcoal/10 bg-white p-6 sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
        <HeadingIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-center font-display text-2xl font-bold text-brand-charcoal">{heading[0]}</h2>
      <p className="mt-1 break-words text-center text-sm text-brand-charcoal/60">{heading[1]}</p>

      {view === "signin" || view === "register" ? (
        <div role="tablist" aria-label="Account" className="mt-6 grid grid-cols-2 rounded-full bg-brand-charcoal/5 p-1">
          {[
            ["signin", "Sign In"],
            ["register", "Create Account"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => goTo(key)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
                view === key ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-charcoal/60 hover:text-brand-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <Notice notice={notice} />

      {view === "loading" ? (
        <p role="status" aria-busy="true" className="mt-6 text-center text-sm text-brand-charcoal/60">
          Loading&hellip;
        </p>
      ) : null}

      {view === "signin" ? (
        <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
          <Field
            id={`${uid}-email`}
            label="Email Address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={form.email}
            onChange={setField("email")}
          />
          <PasswordField
            id={`${uid}-password`}
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={setField("password")}
          />
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      ) : null}

      {view === "register" ? (
        <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-4">
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
          <Field
            id={`${uid}-email`}
            label="Email Address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={form.email}
            onChange={setField("email")}
          />
          <PasswordField
            id={`${uid}-password`}
            label="Password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            value={form.password}
            onChange={setField("password")}
          />
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? "Sending code…" : "Create Account"}
          </button>
        </form>
      ) : null}

      {view === "verify" ? (
        <>
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor={`${uid}-code`} className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
                Verification Code
              </label>
              <input
                id={`${uid}-code`}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
                value={form.code}
                onChange={(event) => setField("code")(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${inputClass} text-center font-mono text-lg tracking-[0.5em]`}
              />
            </div>
            <button type="submit" disabled={busy || form.code.length !== 6} className={primaryButtonClass}>
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={handleResend} disabled={busy || secondsUntilResend > 0} className={linkButtonClass}>
              {secondsUntilResend > 0 ? `Resend code in ${secondsUntilResend}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                goTo("register");
              }}
              className={linkButtonClass}
            >
              Use a different email
            </button>
          </div>
        </>
      ) : null}

      {view === "signedin" ? (
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/shop"
            className="w-full rounded-full bg-brand-red px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
          >
            Continue Shopping
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-charcoal/20 px-6 py-3 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {busy ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
