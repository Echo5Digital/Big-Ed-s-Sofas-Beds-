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

export default function WishlistPage() {
  const { wishlistIds } = useDemoCart();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    getProducts({ pageSize: 100 })
      .then((data) => setProducts(data.products.map(normalizeProductForCard)))
      .catch(() => setProducts([]));
  }, []);

  const wishlistProducts = products.filter((product) => wishlistIds.includes(product.id));

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
