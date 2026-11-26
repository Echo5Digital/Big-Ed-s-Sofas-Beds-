"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, MapPin, Package, Settings } from "lucide-react";
import ProfileSection from "@/components/account/ProfileSection";
import AddressesSection from "@/components/account/AddressesSection";
import OrdersSection from "@/components/account/OrdersSection";
import SettingsSection from "@/components/account/SettingsSection";

const SECTIONS = [
  { key: "profile", label: "Profile", title: "My Profile", Icon: User },
  { key: "addresses", label: "Addresses", title: "Manage Addresses", Icon: MapPin },
  { key: "orders", label: "My Orders", title: "My Orders", Icon: Package },
  { key: "settings", label: "Settings", title: "Settings", Icon: Settings },
];
const SECTION_KEYS = new Set(SECTIONS.map((section) => section.key));

function initialsOf(customer) {
  const letters = [customer.firstName, customer.lastName]
    .map((name) => name?.trim()?.[0])
    .filter(Boolean)
    .join("");
  return (letters || customer.email?.[0] || "?").toUpperCase();
}

// The signed-in /account page: a left sidebar with four sections and the chosen
// one on the right. Only the active section is mounted, and each one loads its
// own data when opened.
export default function AccountDashboard({ customer, onProfileSaved, onSessionExpired, onSignOut, signingOut }) {
  const searchParams = useSearchParams();
  // Lets a link from elsewhere (e.g. the Return flow's post-submit redirect,
  // app/contact/page.jsx) land directly on a specific section instead of
  // always opening to Profile — read once on mount via lazy useState
  // initializer, same as a normal default, so switching sections by clicking
  // the sidebar afterward isn't fighting a URL that no longer matches.
  const [active, setActive] = useState(() => {
    const requested = searchParams.get("tab");
    return SECTION_KEYS.has(requested) ? requested : "profile";
  });
  const section = SECTIONS.find((item) => item.key === active);

  return (
    <div className="mt-6">
      {/* Profile banner — a dark gradient header (same family as PageHero/
          AccountHero) rather than a plain white strip, so the signed-in
          dashboard opens with the same brand presence as every other hero
          on the site instead of reading like a generic settings page.
          flex-col on phones (avatar above name) avoids a long email/name
          squeezing into a cramped single row next to a fixed-size avatar. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-charcoal via-brand-charcoal to-brand-charcoal-soft p-5 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-gold font-display text-2xl font-bold text-brand-charcoal ring-4 ring-white/10 sm:size-18"
          >
            {initialsOf(customer)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-brand-gold uppercase">Welcome back</p>
            <p className="mt-0.5 truncate font-display text-2xl font-bold text-white sm:text-3xl">
              {customer.firstName || "friend"}
            </p>
            {customer.email ? <p className="mt-0.5 truncate text-sm text-white/60">{customer.email}</p> : null}
          </div>
        </div>
      </div>

      {/* minmax(0, 1fr) rather than the implicit auto track: otherwise on
          phones the single column grows to the sidebar's non-wrapping
          buttons and pushes the whole page wider than the screen. */}
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[17rem_minmax(0,1fr)] md:items-start lg:gap-7">
        <aside className="min-w-0 md:sticky md:top-6">
          <nav aria-label="Account sections" className="rounded-2xl border border-brand-charcoal/10 bg-white p-2 shadow-sm">
            {/* 2x2 on phones so every item (and the active one) stays visible. */}
            <ul className="grid grid-cols-2 gap-1.5 md:flex md:flex-col">
              {SECTIONS.map(({ key, label, Icon }) => {
                const isActive = key === active;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setActive(key)}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-brand-red md:py-3 ${
                        isActive
                          ? "bg-brand-red text-white shadow-md shadow-brand-red/25"
                          : "text-brand-charcoal/70 hover:bg-brand-red/5 hover:text-brand-red"
                      }`}
                    >
                      <Icon
                        className={`size-4 shrink-0 ${isActive ? "text-white" : "text-brand-charcoal/40 group-hover:text-brand-red"}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <section
          aria-labelledby="account-section-title"
          className="min-w-0 rounded-2xl border border-brand-charcoal/10 bg-white p-4 shadow-sm sm:p-6 lg:p-8"
        >
          <div className="flex items-center gap-3 border-b border-brand-charcoal/10 pb-4 sm:pb-5">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red"
            >
              <section.Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 id="account-section-title" className="font-display text-lg font-bold text-brand-charcoal sm:text-xl lg:text-2xl">
              {section.title}
            </h2>
          </div>
          <div className="mt-5 sm:mt-6">
            {active === "profile" ? (
              <ProfileSection onSessionExpired={onSessionExpired} onProfileSaved={onProfileSaved} />
            ) : null}
            {active === "addresses" ? <AddressesSection onSessionExpired={onSessionExpired} /> : null}
            {active === "orders" ? <OrdersSection onSessionExpired={onSessionExpired} /> : null}
            {active === "settings" ? (
              <SettingsSection onSessionExpired={onSessionExpired} onSignOut={onSignOut} signingOut={signingOut} />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
