"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { X, MapPin, ArrowRight } from "lucide-react";
import { siteConfig } from "@/lib/mock-data/site-config";
import Button from "@/components/ui/Button";

export default function MobileNavigation({ open, onClose }) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col gap-6 overflow-y-auto bg-brand-cream p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-brand-red-dark">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-full p-2 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Mobile">
          <ul className="flex flex-col gap-1">
            {siteConfig.nav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`block rounded-lg px-3 py-2.5 text-base font-semibold hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red ${
                    item.label === "Deals" ? "text-brand-red" : "text-brand-charcoal"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <Button href="#" variant="primary" icon={ArrowRight} className="w-full" onClick={onClose}>
            Shop Now
          </Button>
          <Button
            href="#"
            variant="gold"
            icon={MapPin}
            iconPosition="left"
            className="w-full"
            onClick={onClose}
          >
            Visit Showroom
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
