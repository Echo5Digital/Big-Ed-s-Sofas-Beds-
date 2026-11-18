"use client";

import { useState } from "react";
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
  const [active, setActive] = useState("profile");
  const section = SECTIONS.find((item) => item.key === active);

  return (
    // minmax(0, 1fr) rather than the implicit auto track: otherwise on phones the
    // single column grows to the sidebar's non-wrapping buttons and pushes the
    // whole page wider than the screen.
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[17rem_minmax(0,1fr)] md:items-start lg:gap-7">
      <aside className="flex min-w-0 flex-col gap-4 md:sticky md:top-6">
        <div className="flex items-center gap-3.5 rounded-2xl border border-brand-charcoal/10 bg-white p-5 shadow-sm">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-red/10 font-display text-xl font-bold text-brand-red ring-4 ring-brand-red/5"
          >
            {initialsOf(customer)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-charcoal/50">Welcome back</p>
            <p className="truncate font-display text-lg font-bold text-brand-charcoal">
              {customer.firstName || "friend"}
            </p>
          </div>
        </div>

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
                    className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
                      isActive
                        ? "bg-brand-red text-white shadow-sm shadow-brand-red/20"
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
        className="min-w-0 rounded-2xl border border-brand-charcoal/10 bg-white p-5 shadow-sm sm:p-8"
      >
        <div className="flex items-center gap-3 border-b border-brand-charcoal/10 pb-5">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red"
          >
            <section.Icon className="size-5" aria-hidden="true" />
          </span>
          <h2 id="account-section-title" className="font-display text-xl font-bold text-brand-charcoal sm:text-2xl">
            {section.title}
          </h2>
        </div>
        <div className="mt-6">
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
  );
}
