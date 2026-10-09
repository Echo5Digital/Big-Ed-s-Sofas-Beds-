"use client";

import { useId, useState } from "react";
import { Mail } from "lucide-react";
import Container from "@/components/ui/Container";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const messageId = useId();

  function handleSubmit(event) {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email.trim())) {
      setStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    // Demo-only: newsletter integration is not yet connected to a backend.
    setStatus({
      type: "success",
      message: "Thanks! Newsletter sign-up is a demo only for now — email integration is coming soon.",
    });
    setEmail("");
  }

  return (
    <section id="newsletter" className="bg-brand-cream py-10">
      <Container className="flex flex-col items-center gap-6 rounded-2xl border border-brand-charcoal/10 bg-white/60 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 text-center lg:text-left">
          <Mail className="mt-1 hidden size-7 shrink-0 text-brand-red sm:block" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-charcoal sm:text-2xl">
              Get Special Offers &amp; Save Big!
            </h2>
            <p className="mt-1 text-sm text-brand-charcoal/70">
              Be the first to know about new arrivals, exclusive deals and more.
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-md flex-col gap-2">
          <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-2 sm:flex-row sm:gap-3">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address"
              aria-describedby={status ? messageId : undefined}
              aria-invalid={status?.type === "error"}
              className="w-full min-w-0 rounded-full border border-brand-charcoal/20 bg-white px-4 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
            >
              Sign Up
            </button>
          </form>

          {status && (
            <p
              id={messageId}
              role="status"
              className={`text-sm ${status.type === "error" ? "text-brand-red" : "text-brand-charcoal/70"}`}
            >
              {status.message}
            </p>
          )}
        </div>
      </Container>
    </section>
  );
}
