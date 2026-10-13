import { notFound } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, AlertCircle } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import StarRating from "@/components/ui/StarRating";
import Price from "@/components/ui/Price";
import ProductCard from "@/components/home/ProductCard";
import ProductPurchasePanel from "@/components/products/ProductPurchasePanel";
import { products } from "@/lib/mock-data/products";
import { categories } from "@/lib/mock-data/categories";
import { getRelatedProducts } from "@/lib/shop";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  if (!product) {
    return { title: "Product Not Found | Big Ed's Sofas & Beds" };
  }
  return {
    title: `${product.name} | Big Ed's Sofas & Beds`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);

  if (!product) {
    notFound();
  }

  const category = categories.find((c) => c.slug === product.category);
  const related = getRelatedProducts(product);
  const inStock = product.stockStatus !== "out-of-stock";

  return (
    <div className="pb-10">
      <Container className="pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop All", href: "/shop" },
            ...(category ? [{ label: category.name, href: `/shop/${category.slug}` }] : []),
            { label: product.name },
          ]}
        />
      </Container>

      <Container className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-brand-cream shadow-sm">
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          {product.badge && (
            <span className="absolute left-4 top-4 rounded px-2.5 py-1 text-xs font-bold tracking-wide bg-brand-red text-white">
              {product.badge}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-charcoal/50">
              SKU: {product.sku}
            </p>
          </div>

          <StarRating rating={product.rating} reviewCount={product.reviewCount} size="md" />

          <Price price={product.price} compareAtPrice={product.compareAtPrice} />

          <p className="text-sm leading-relaxed text-brand-charcoal/75 sm:text-base">
            {product.description}
          </p>

          <div
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
              inStock
                ? "border-green-600/20 bg-green-600/5 text-green-800"
                : "border-brand-red/20 bg-brand-red/5 text-brand-red-dark"
            }`}
          >
            {inStock ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {inStock
                ? `In stock — ${product.stockLocations.join(" & ")}`
                : "Currently out of stock — check back soon"}
              {product.stockStatus === "limited" && " (limited quantity available)"}
              <span className="mt-0.5 block text-xs font-normal opacity-70">
                Availability shown is demo inventory data, not a live stock feed.
              </span>
            </span>
          </div>

          <dl className="grid grid-cols-3 gap-3 rounded-xl border border-brand-charcoal/10 bg-white p-4 text-center">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">Width</dt>
              <dd className="mt-1 text-sm font-bold text-brand-charcoal">{product.dimensions.width}&quot;</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">Height</dt>
              <dd className="mt-1 text-sm font-bold text-brand-charcoal">{product.dimensions.height}&quot;</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">Depth</dt>
              <dd className="mt-1 text-sm font-bold text-brand-charcoal">{product.dimensions.depth}&quot;</dd>
            </div>
          </dl>

          <ProductPurchasePanel product={product} />
        </div>
      </Container>

      {related.length > 0 && (
        <Container className="mt-14">
          <h2 className="font-display text-xl font-semibold text-brand-charcoal sm:text-2xl">
            You May Also Like
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </Container>
      )}
    </div>
  );
}
