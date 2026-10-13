"use client";

import { useState } from "react";
import { User, Info } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";

export default function AccountPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-md">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />

        <div className="mt-6 rounded-2xl border border-brand-charcoal/10 bg-white p-6 sm:p-8">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <User className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-center font-display text-2xl font-bold text-brand-charcoal">
            Sign In to Your Account
          </h1>
          <p className="mt-1 text-center text-sm text-brand-charcoal/60">
            Track orders, save favorites, and check out faster.
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-brand-gold/15 px-4 py-3 text-xs text-brand-charcoal/80">
            <Info className="mt-0.5 size-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />
            <span>Account functionality is coming soon. This form is a demo only and does not create a real account or sign you in.</span>
          </div>

          {submitted ? (
            <p role="status" className="mt-6 rounded-lg bg-green-600/10 px-4 py-3 text-center text-sm font-medium text-green-800">
              Thanks for trying the demo! Real sign-in is coming soon.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="account-email" className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
                  Email Address
                </label>
                <input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="account-password" className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
                  Password
                </label>
                <input
                  id="account-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                />
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
              >
                Sign In
              </button>
            </form>
          )}
        </div>
      </Container>
    </div>
  );
}
