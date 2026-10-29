"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { User, Mail } from "lucide-react";
import {
  registerCustomer,
  verifyRegistrationCode,
  resendRegistrationCode,
  loginCustomer,
  logoutCustomer,
  getCurrentCustomer,
} from "@/lib/api/customerAuth";
import AccountDashboard from "@/components/account/AccountDashboard";
import {
  Field,
  Notice,
  PasswordField,
  describeError,
  linkButtonClass,
  primaryButtonClass,
  reasonOf,
} from "@/components/account/formParts";

const EMPTY_FORM = { firstName: "", lastName: "", email: "", password: "", code: "" };

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

  // Called by the account sections when even a refresh can't restore the
  // session (e.g. the refresh cookie has lapsed). Stable so the sections'
  // data-loading effects don't re-run on every render of this panel.
  const handleSessionExpired = useCallback(() => {
    setCustomer(null);
    setNotice({ type: "info", message: "Your session has expired. Please sign in again." });
    setView("signin");
  }, []);

  // Keeps the "Hello, name" in the sidebar in step with a saved profile edit.
  const handleProfileSaved = useCallback((names) => {
    setCustomer((current) => (current ? { ...current, ...names } : current));
  }, []);

  if (view === "signedin") {
    return (
      <AccountDashboard
        customer={customer}
        onProfileSaved={handleProfileSaved}
        onSessionExpired={handleSessionExpired}
        onSignOut={handleLogout}
        signingOut={busy}
      />
    );
  }

  const heading = {
    loading: ["Your Account", ""],
    signin: ["Sign In to Your Account", "Track orders, save favorites, and check out faster."],
    register: ["Create Your Account", "It only takes a minute. We'll email you a code to confirm your address."],
    verify: ["Check Your Email", pending ? `Enter the 6-digit code we sent to ${pending.email}.` : ""],
  }[view];

  const HeadingIcon = view === "verify" ? Mail : User;

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-brand-charcoal/10 bg-white p-6 sm:p-8">
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

    </div>
  );
}
