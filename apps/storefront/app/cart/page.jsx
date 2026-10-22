"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import PageHero from "@/components/ui/PageHero";
import { useDemoCart } from "@/components/layout/DemoCartProvider";
import { formatCurrency } from "@/utils/formatCurrency";

export default function CartPage() {
  const { cartItems, cartSubtotal, updateQuantity, removeFromCart } = useDemoCart();

  return (
    <div className="pb-10">
      <PageHero title="Your Cart" showMascot={false} />

      <Container className="mt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />

        {cartItems.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Looks like you haven't added anything yet. Start browsing to find your next favorite piece."
              actionLabel="Shop Furniture"
              actionHref="/shop"
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              {cartItems.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-4 rounded-xl border border-brand-charcoal/10 bg-white p-4"
                >
                  <Link
                    href={`/products/${item.slug}`}
                    className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-brand-cream sm:size-24"
                  >
                    {item.image && (
                      <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/products/${item.slug}`}
                        className="text-sm font-semibold text-brand-charcoal hover:text-brand-red-dark sm:text-base"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.variantId)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="rounded-full p-2.5 text-brand-charcoal/40 hover:bg-brand-red/5 hover:text-brand-red-dark focus-visible:outline-2 focus-visible:outline-brand-red"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-full border border-brand-charcoal/20 bg-white">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="flex size-10 items-center justify-center rounded-full text-brand-charcoal hover:bg-brand-charcoal/5"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-brand-charcoal">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="flex size-10 items-center justify-center rounded-full text-brand-charcoal hover:bg-brand-charcoal/5"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-brand-charcoal sm:text-base">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-fit rounded-xl border border-brand-charcoal/10 bg-white p-5">
              <h2 className="font-display text-lg font-semibold text-brand-charcoal">Order Summary</h2>
              <div className="mt-4 flex items-center justify-between text-sm text-brand-charcoal/70">
                <span>Subtotal</span>
                <span className="font-semibold text-brand-charcoal">{formatCurrency(cartSubtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-brand-charcoal/50">
                Delivery fees, pickup scheduling and tax are calculated at checkout.
              </p>
              <Button href="/checkout" variant="primary" size="lg" icon={ArrowRight} className="mt-5 w-full">
                Proceed to Checkout
              </Button>
              <Link
                href="/shop"
                className="mt-3 block text-center text-sm font-semibold text-brand-red-dark hover:underline"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
