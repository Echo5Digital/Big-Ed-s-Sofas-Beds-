"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, User, ShoppingBag, Menu, ArrowRight, MapPin } from "lucide-react";
import { siteConfig } from "@/lib/mock-data/site-config";
import { useDemoCart } from "@/components/layout/DemoCartProvider";
import SearchBox from "@/components/layout/SearchBox";
import MobileNavigation from "@/components/layout/MobileNavigation";
import Button from "@/components/ui/Button";

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartCount, wishlistIds } = useDemoCart();

  return (
    <header className="sticky top-0 z-40 border-b border-brand-charcoal/10 bg-brand-cream/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-3 sm:px-6 lg:gap-1.5 lg:px-3 xl:gap-3 xl:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src={siteConfig.logo.src}
            alt={siteConfig.logo.alt}
            width={siteConfig.logo.width}
            height={siteConfig.logo.height}
            priority
            className="h-18 w-auto sm:h-20 lg:h-18 xl:h-24"
          />
        </Link>

        <nav aria-label="Primary" className="hidden min-w-0 flex-1 lg:block">
          <ul className="flex items-center justify-center gap-1 whitespace-nowrap text-[13px] font-semibold text-brand-charcoal xl:gap-3 xl:text-sm">
            {siteConfig.nav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center rounded px-1 py-1.5 hover:text-brand-red-dark focus-visible:outline-2 focus-visible:outline-brand-red ${
                    item.label === "Deals" ? "text-brand-red" : ""
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto hidden shrink-0 flex-col items-end gap-2 lg:flex">
          <div className="flex items-center gap-1.5">
            <div className="w-40 xl:w-56 2xl:w-64">
              <SearchBox />
            </div>
            <Link
              href="/wishlist"
              aria-label={`Wishlist, ${wishlistIds.length} item${wishlistIds.length === 1 ? "" : "s"}`}
              className="relative rounded-full p-1.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
            >
              <Heart className="size-5" aria-hidden="true" />
              {wishlistIds.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                  {wishlistIds.length}
                </span>
              )}
            </Link>
            <Link
              href="/account"
              aria-label="Account"
              className="rounded-full p-1.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
            >
              <User className="size-5" aria-hidden="true" />
            </Link>
            <Link
              href="/cart"
              aria-label={`Shopping cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="relative rounded-full p-1.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
            >
              <ShoppingBag className="size-5" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          <div className="flex w-full items-center gap-1.5">
            <Button href="/shop" variant="primary" size="sm" icon={ArrowRight} className="flex-1">
              Shop Now
            </Button>
            <Button href="/about" variant="gold" size="sm" icon={MapPin} iconPosition="left" className="flex-1">
              Visit Showroom
            </Button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1 lg:hidden">
          <Link
            href="/wishlist"
            aria-label={`Wishlist, ${wishlistIds.length} item${wishlistIds.length === 1 ? "" : "s"}`}
            className="relative rounded-full p-2.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            <Heart className="size-5" aria-hidden="true" />
            {wishlistIds.length > 0 && (
              <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                {wishlistIds.length}
              </span>
            )}
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className="hidden rounded-full p-2.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red sm:block"
          >
            <User className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href="/cart"
            aria-label={`Shopping cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            className="relative rounded-full p-2.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-full p-2.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="border-t border-brand-charcoal/5 px-4 pb-3 pt-2 lg:hidden">
        <SearchBox />
      </div>

      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
