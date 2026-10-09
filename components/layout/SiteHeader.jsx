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
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-3 sm:px-6 lg:gap-2 lg:px-4 xl:gap-3 xl:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src={siteConfig.logo.src}
            alt={siteConfig.logo.alt}
            width={siteConfig.logo.width}
            height={siteConfig.logo.height}
            priority
            className="h-16 w-auto sm:h-18 lg:h-16 xl:h-20"
          />
        </Link>

        <nav aria-label="Primary" className="hidden shrink-0 lg:block">
          <ul className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-brand-charcoal xl:gap-3">
            {siteConfig.nav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`rounded px-1 py-1.5 hover:text-brand-red-dark focus-visible:outline-2 focus-visible:outline-brand-red ${
                    item.label === "Deals" ? "text-brand-red" : ""
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden min-w-30 flex-1 xl:block xl:max-w-50 2xl:max-w-65">
          <SearchBox />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <Link
            href="#"
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
            href="#"
            aria-label="Account"
            className="hidden rounded-full p-1.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red sm:block"
          >
            <User className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href="#"
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

          <div className="ml-1 hidden items-center gap-2 lg:flex">
            <Button href="#" variant="primary" size="sm" icon={ArrowRight}>
              Shop Now
            </Button>
            <div className="hidden min-[1440px]:block">
              <Button href="#" variant="gold" size="sm" icon={MapPin} iconPosition="left">
                Visit Showroom
              </Button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-full p-1.5 text-brand-charcoal hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-brand-red lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="border-t border-brand-charcoal/5 px-4 pb-3 pt-2 xl:hidden">
        <SearchBox />
      </div>

      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
