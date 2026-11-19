"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPin, Tag, Truck } from "lucide-react";
import Container from "@/components/ui/Container";
import PageHero from "@/components/ui/PageHero";
import AccountPanel from "@/components/account/AccountPanel";

// Mirrors three of site-config's real `benefits` entries (home/BenefitsSection.jsx)
// as a compact trust row under the hero copy — lucide icons rather than that
// section's illustrated stickers, which read too playful next to a sign-in form.
const TRUST_POINTS = [
  { Icon: Truck, label: "Fast Delivery" },
  { Icon: MapPin, label: "Local Showroom" },
  { Icon: Tag, label: "Great Prices" },
];

// Full-bleed lifestyle-photo hero for the standalone /account page — the
// floating sign-in/create-account card sits over a real showroom photo
// instead of the flat PageHero banner every other page uses. Deliberately a
// separate component from PageHero, which checkout's embedded AccountPanel
// (app/checkout/page.jsx) keeps using as-is with its plain banner +
// in-flow card layout.
//
// The signed-in dashboard (AccountDashboard, rendered by AccountPanel once
// view === "signedin") is a wide two-column layout that has no business
// sitting in a narrow card over a photo, so this falls back to the same flat
// PageHero + Container chrome every other page uses as soon as the customer
// is authenticated. AccountPanel's onViewChange keeps this in sync.
//
// Known tradeoff: the two chrome variants (photo hero vs. flat dashboard
// banner) are different enough — a wide two-column dashboard can't live
// inside a narrow floating card — that avoiding a remount here isn't
// practical without real duplication or a portal. Because the two branches
// below are structurally different JSX trees, React unmounts and remounts
// AccountPanel on the loading -> signedin transition specifically: a
// returning signed-in customer briefly sees the signed-out photo hero, then
// it swaps to the dashboard and AccountPanel's mount effect runs a second
// getCurrentCustomer() check. That second check is harmless (same cookies,
// same answer, just an extra read) and the flash is sub-second on a local
// network — a known, accepted edge case, not a loop or a data bug.
export default function AccountHero() {
  const [view, setView] = useState("loading");
  const signedIn = view === "signedin";

  if (signedIn) {
    return (
      <div className="pb-10">
        <PageHero title="Account" showMascot={false} />
        <Container className="mt-8">
          <AccountPanel onViewChange={setView} />
        </Container>
      </div>
    );
  }

  return (
    <section className="relative isolate overflow-hidden bg-brand-charcoal">
      <div className="absolute inset-0">
        <Image
          src="/Shop your dream furniture BigED.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Same warm, airy showroom-loft photo as /shop's hero (components/ui/
            ShopPageHero.jsx) — already proven to read well under a gradient.
            Side-lit rather than a flat dark wash: strong charcoal under the
            copy/card, fading to a thin, warm gold-tinted edge on the photo's
            open side so the room still reads as a real, bright space. */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal via-brand-charcoal/85 to-brand-charcoal/40 sm:bg-gradient-to-r sm:from-brand-charcoal sm:via-brand-charcoal/75 sm:to-brand-gold/10" />
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-brand-gold via-brand-gold to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-10 lg:py-28">
        <div className="max-w-lg text-center lg:text-left">
          <span className="inline-block rounded-full border border-brand-gold/40 bg-brand-gold/10 px-4 py-1 font-display text-xs font-semibold tracking-wide text-brand-gold uppercase">
            Welcome Back
          </span>
          <h1 className="mt-4 font-display text-4xl leading-tight font-bold text-white drop-shadow-md sm:text-5xl lg:text-6xl">
            Your Dream Home
            <br />
            <span className="text-brand-gold underline decoration-brand-red decoration-4 underline-offset-8">
              Starts Here
            </span>
          </h1>
          <p className="mt-5 text-sm text-white/80 drop-shadow-sm sm:text-base">
            Sign in to track orders, save favorites, and check out faster — or create an account in under a minute.
          </p>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 lg:justify-start">
            {TRUST_POINTS.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-white/90">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand-gold">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative w-full max-w-md">
          <div
            className="animate-account-glow-pulse absolute -inset-6 -z-10 rounded-[2rem] bg-brand-gold/25 blur-2xl sm:-inset-10"
            aria-hidden="true"
          />
          <AccountPanel onViewChange={setView} glass />
        </div>
      </div>
    </section>
  );
}
