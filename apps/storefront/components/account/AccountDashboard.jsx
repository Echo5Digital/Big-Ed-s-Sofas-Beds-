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
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[17rem_minmax(0,1fr)] md:items-start">
      <aside className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl border border-brand-charcoal/10 bg-white p-4">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-red/10 font-display text-lg font-bold text-brand-red"
          >
            {initialsOf(customer)}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-brand-charcoal/60">Hello,</p>
            <p className="truncate font-display text-base font-bold text-brand-charcoal">
              {customer.firstName || "friend"}
            </p>
          </div>
        </div>

        <nav aria-label="Account sections" className="rounded-2xl border border-brand-charcoal/10 bg-white p-2">
          {/* 2x2 on phones so every item (and the active one) stays visible. */}
          <ul className="grid grid-cols-2 gap-1 md:flex md:flex-col">
            {SECTIONS.map(({ key, label, Icon }) => {
              const isActive = key === active;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setActive(key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
                      isActive
                        ? "bg-brand-red/10 text-brand-red"
                        : "text-brand-charcoal/70 hover:bg-brand-charcoal/5 hover:text-brand-charcoal"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <section
        aria-labelledby="account-section-title"
        className="min-w-0 rounded-2xl border border-brand-charcoal/10 bg-white p-6 sm:p-8"
      >
        <h2 id="account-section-title" className="font-display text-2xl font-bold text-brand-charcoal">
          {section.title}
        </h2>
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
