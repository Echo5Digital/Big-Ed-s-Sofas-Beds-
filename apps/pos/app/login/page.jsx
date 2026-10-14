"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { ApiClientError } from "@/lib/api/client";

export default function LoginPage() {
  const { login, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold">
            <Lock className="size-6" aria-hidden="true" />
          </span>
          <h1 className="font-display text-xl font-bold text-brand-charcoal">BIG ED POS</h1>
          <p className="text-sm text-brand-charcoal/60">Cashier sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-brand-charcoal">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-3 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-brand-charcoal">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-3 text-base focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-brand-red px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
