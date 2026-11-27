"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { siteConfig } from "@/lib/mock-data/site-config";
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
  inputClass,
  inputGlassClass,
  linkButtonClass,
  primaryButtonClass,
  reasonOf,
} from "@/components/account/formParts";

const EMPTY_FORM = { firstName: "", lastName: "", email: "", password: "", code: "" };

// linkButtonClass's brand-red text has too little contrast on glass mode's
// frosted/dark-photo surface — this panel's own glass-only equivalent, not
// moved into formParts.jsx since no dashboard form ever renders glass.
const glassLinkButtonClass =
  "-my-2 inline-block py-2 text-sm font-semibold text-white/90 underline-offset-2 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:text-white/40 disabled:no-underline";

// "Magic card" pointer-tilt + light-sheen that follows the cursor — mouse
// only (a touch device has no hover position to track, and faking one on
// tap would just make the card jitter), and skipped under
// prefers-reduced-motion. Sets CSS custom properties read by the card's
// inline transform/sheen-gradient styles rather than calling setState per
// pixel, so this never re-renders the form inputs on every mouse move.
function useCardTilt(glass) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !glass) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (!window.matchMedia("(pointer: fine)").matches) return undefined;

    function handleMove(event) {
      const rect = node.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const tiltX = (0.5 - py) * 10;
      const tiltY = (px - 0.5) * 10;
      node.style.setProperty("--tilt-x", `${tiltX}deg`);
      node.style.setProperty("--tilt-y", `${tiltY}deg`);
      node.style.setProperty("--sheen-x", `${px * 100}%`);
      node.style.setProperty("--sheen-y", `${py * 100}%`);
      node.style.setProperty("--sheen-opacity", "1");
    }

    function handleLeave() {
      node.style.setProperty("--tilt-x", "0deg");
      node.style.setProperty("--tilt-y", "0deg");
      node.style.setProperty("--sheen-opacity", "0");
    }

    node.addEventListener("mousemove", handleMove);
    node.addEventListener("mouseleave", handleLeave);
    return () => {
      node.removeEventListener("mousemove", handleMove);
      node.removeEventListener("mouseleave", handleLeave);
    };
  }, [glass]);

  return ref;
}

// onSignedIn is opt-in (default no-op) — fired right after a successful
// sign-in or just-verified registration, before the dashboard view renders.
// /account itself doesn't need it; the checkout page's sign-in gate
// (app/checkout/page.jsx) uses it to resume checkout once the customer is
// authenticated.
//
// onViewChange is also opt-in (default no-op) — fired on every view
// transition so a parent that wraps this panel differently depending on
// auth state (AccountHero's photo backdrop only makes sense around the
// narrow signed-out card, not the wide signed-in dashboard) can react
// without re-fetching getCurrentCustomer itself.
//
// glass swaps the card to a frosted/translucent surface — only looks right
// over a photo backdrop with real contrast behind it (AccountHero's
// signed-out view), so it defaults to false: checkout's plain-page embed and
// /account's flat signed-in fallback both keep the solid white card.
export default function AccountPanel({ onSignedIn = () => {}, onViewChange = () => {}, glass = false }) {
  const uid = useId();
  const cardRef = useCardTilt(glass);
  // loading | signin | register | verify | signedin
  const [view, setViewState] = useState("loading");
  // Mirrors `view` synchronously (state itself only updates on the next
  // render) so the initial-load effect below can tell, the instant its
  // getCurrentCustomer() call resolves, whether the user already navigated
  // away from "loading" — and if so, skip clobbering their choice.
  const viewRef = useRef("loading");
  const setView = useCallback(
    (next) => {
      viewRef.current = next;
      setViewState(next);
      onViewChange(next);
    },
    [onViewChange]
  );
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
        // getCurrentCustomer can take two round trips (a /me 401 falls
        // through to /refresh — see lib/api/customerAuth.js), slow enough
        // that an impatient visitor can tap "Create Account" (or even submit
        // the sign-up form) while this is still in flight. Only this effect's
        // own initial "loading" -> signin/signedin transition belongs here;
        // once the user has navigated to a real view (viewRef no longer
        // "loading"), this resolving late must never stomp back over their
        // choice — that was bouncing a mid-signup visitor back to "Sign In"
        // for no reason they caused.
        if (cancelled || viewRef.current !== "loading") return;
        setCustomer(current);
        setView(current ? "signedin" : "signin");
      })
      .catch(() => {
        // Can't tell (API unreachable): show the sign-in form rather than a
        // blank card; submitting it will surface the real connection error.
        // Same late-resolution guard as above.
        if (!cancelled && viewRef.current === "loading") setView("signin");
      });
    return () => {
      cancelled = true;
    };
    // setView is a React state setter, guaranteed stable across renders —
    // listed to satisfy exhaustive-deps, not because it can ever actually
    // change and re-run this effect.
  }, [setView]);

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
        onSignedIn(verified);
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
    // Checked explicitly (the form itself is noValidate, see below) rather
    // than relying on the inputs' own `required` — a mobile browser's
    // autofill/password-manager can visibly fill a field without firing the
    // input event React's controlled value depends on, leaving form.password
    // empty here even though the field looks filled in. Native HTML5
    // validation would then silently block submission and try to show its
    // own validation bubble, which this card's overflow-hidden can clip
    // off-screen entirely — reading as the button doing nothing at all, with
    // no visible error anywhere. Catching it here instead always surfaces a
    // real, visible notice.
    if (!form.email.trim() || !form.password) {
      setNotice({ type: "error", message: "Enter your email and password to sign in." });
      return undefined;
    }
    return run(async () => {
      try {
        const signedIn = await loginCustomer({ email: form.email, password: form.password });
        setCustomer(signedIn);
        setForm(EMPTY_FORM);
        goTo("signedin");
        onSignedIn(signedIn);
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
    // setCustomer/setNotice/setView are all React state setters, guaranteed
    // stable across renders — listed to satisfy exhaustive-deps, not because
    // any of them can actually change and invalidate this callback's identity
    // (the comment above this function depends on that staying true).
  }, [setCustomer, setNotice, setView]);

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

  return (
    <div
      ref={cardRef}
      style={
        glass
          ? {
              transform: "perspective(1200px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
              transition: "transform 0.15s ease-out",
            }
          : undefined
      }
      className={`animate-account-view-in relative mx-auto w-full max-w-md overflow-hidden rounded-2xl p-6 pt-7 sm:p-8 sm:pt-9 ${
        glass
          ? "border border-white/30 bg-white/15 shadow-2xl shadow-black/30 backdrop-blur-xl"
          : "border border-brand-charcoal/10 bg-white shadow-2xl shadow-black/20"
      }`}
    >
      {glass ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: "var(--sheen-opacity, 0)",
            background:
              "radial-gradient(circle at var(--sheen-x, 50%) var(--sheen-y, 50%), rgba(255,255,255,0.35), transparent 45%)",
          }}
        />
      ) : null}
      <span className="absolute inset-x-0 top-0 h-1.5 overflow-hidden bg-gradient-to-r from-brand-gold via-brand-gold-dark to-brand-gold" aria-hidden="true">
        <span className="animate-account-card-shine absolute inset-y-0 left-0 w-1/4 bg-white/60 blur-[2px]" />
      </span>
      {glass ? (
        <>
          <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand-gold/30 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 size-44 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
        </>
      ) : null}
      <Image
        src={siteConfig.logo.src}
        alt={siteConfig.logo.alt}
        width={siteConfig.logo.width}
        height={siteConfig.logo.height}
        className={`relative mx-auto h-20 w-auto sm:h-24 ${glass ? "drop-shadow-lg" : ""}`}
      />
      <h2
        className={`relative mt-5 text-center font-display text-2xl font-bold ${glass ? "text-white drop-shadow-sm" : "text-brand-charcoal"}`}
      >
        {heading[0]}
      </h2>
      <p className={`relative mt-1.5 break-words text-center text-sm ${glass ? "text-white/75" : "text-brand-charcoal/60"}`}>
        {heading[1]}
      </p>

      {view === "signin" || view === "register" ? (
        <div
          role="tablist"
          aria-label="Account"
          className={`relative mt-6 grid grid-cols-2 rounded-xl p-1 ${glass ? "bg-black/15 backdrop-blur-sm" : "bg-brand-charcoal/5"}`}
        >
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
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-brand-red ${
                view === key
                  ? "bg-brand-red text-white shadow-md shadow-brand-red/30"
                  : glass
                    ? "text-white/70 hover:text-white"
                    : "text-brand-charcoal/60 hover:text-brand-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <Notice notice={notice} glass={glass} className="relative mt-4" />

      {view === "loading" ? (
        <div role="status" aria-busy="true" aria-label="Loading" className="relative mt-6 flex flex-col gap-4">
          <div className={`h-11 animate-pulse rounded-lg ${glass ? "bg-white/15" : "bg-brand-charcoal/5"}`} />
          <div className={`h-11 animate-pulse rounded-lg ${glass ? "bg-white/15" : "bg-brand-charcoal/5"}`} />
          <div className={`mt-2 h-11 animate-pulse rounded-full ${glass ? "bg-white/15" : "bg-brand-charcoal/5"}`} />
        </div>
      ) : null}

      {view === "signin" ? (
        <form onSubmit={handleLogin} noValidate className="animate-account-view-in mt-6 flex flex-col gap-4">
          <Field
            id={`${uid}-email`}
            label="Email Address"
            icon={Mail}
            glass={glass}
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
            icon={Lock}
            glass={glass}
            autoComplete="current-password"
            value={form.password}
            onChange={setField("password")}
          />
          <button type="submit" disabled={busy} className={`${primaryButtonClass} group flex items-center justify-center gap-2`}>
            {busy ? (
              "Signing in…"
            ) : (
              <>
                Sign In
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      ) : null}

      {view === "register" ? (
        <form onSubmit={handleRegister} className="animate-account-view-in mt-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id={`${uid}-first`}
              label="First Name"
              glass={glass}
              autoComplete="given-name"
              required
              maxLength={100}
              value={form.firstName}
              onChange={setField("firstName")}
            />
            <Field
              id={`${uid}-last`}
              label="Last Name"
              glass={glass}
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
            icon={Mail}
            glass={glass}
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
            icon={Lock}
            glass={glass}
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            value={form.password}
            onChange={setField("password")}
          />
          <button type="submit" disabled={busy} className={`${primaryButtonClass} group flex items-center justify-center gap-2`}>
            {busy ? (
              "Sending code…"
            ) : (
              <>
                Create Account
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      ) : null}

      {view === "verify" ? (
        <div className="animate-account-view-in">
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <div>
              <label
                htmlFor={`${uid}-code`}
                className={`mb-1.5 flex items-center justify-center gap-1.5 text-sm font-semibold ${glass ? "text-white/90" : "text-brand-charcoal"}`}
              >
                <ShieldCheck className={`size-4 ${glass ? "text-brand-gold" : "text-brand-gold-dark"}`} aria-hidden="true" />
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
                placeholder="• • • • • •"
                value={form.code}
                onChange={(event) => setField("code")(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${glass ? inputGlassClass : inputClass} text-center font-mono text-xl tracking-[0.6em]`}
              />
            </div>
            <button
              type="submit"
              disabled={busy || form.code.length !== 6}
              className={`${primaryButtonClass} group flex items-center justify-center gap-2`}
            >
              {busy ? (
                "Verifying…"
              ) : (
                <>
                  Verify &amp; Continue
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={busy || secondsUntilResend > 0}
              className={glass ? glassLinkButtonClass : linkButtonClass}
            >
              {secondsUntilResend > 0 ? `Resend code in ${secondsUntilResend}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                goTo("register");
              }}
              className={glass ? glassLinkButtonClass : linkButtonClass}
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
