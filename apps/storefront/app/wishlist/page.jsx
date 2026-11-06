"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import PageHero from "@/components/ui/PageHero";
import ProductCard from "@/components/home/ProductCard";
import { useDemoCart } from "@/components/layout/DemoCartProvider";
import { getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { shuffleProducts } from "@/lib/dailyRotation";

// Bundles the fetched products with the day seed they were fetched alongside
// so both land in a single setState call — currentDaySeed() (lib/
// currentDaySeed.js) is server-only ("use cache"/cacheLife, Server-Component-
// only), and this page is a Client Component (needs useDemoCart's wishlist
// state), so Date.now() is read here instead. It can only be read after
// mount (this app's cacheComponents config forbids it anywhere a prerender
// could observe it — see
// https://nextjs.org/docs/messages/blocking-prerender-current-time-client),
// and react-hooks/set-state-in-effect flags a second, separate setState call
// sitting directly in the effect body as a likely cascading-render bug — a
// single state value holding both avoids needing either.
const INITIAL_STATE = { products: [], daySeed: 0 };

export default function WishlistPage() {
  const { wishlistIds } = useDemoCart();
  const [{ products, daySeed }, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    getProducts({ pageSize: 100, sort: "oldest" })
      .then((data) =>
        setState({
          products: data.products.map(normalizeProductForCard),
          daySeed: Math.floor(Date.now() / 86_400_000),
        })
      )
      .catch(() => setState(INITIAL_STATE));
  }, []);

  const wishlistProducts = shuffleProducts(
    products.filter((product) => wishlistIds.includes(product.id)),
    daySeed,
    "wishlist"
  );

  return (
    <div className="pb-10">
      <PageHero title="Your Wishlist" showMascot={false} />

      <Container className="mt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />

        <div className="mt-6">
          {wishlistProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {wishlistProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Heart}
              title="Your wishlist is empty"
              description="Save furniture you love by tapping the heart icon on any product, so you can find it again later."
              actionLabel="Shop Furniture"
              actionHref="/shop"
            />
          )}
        </div>
      </Container>
    </div>
  );
}
