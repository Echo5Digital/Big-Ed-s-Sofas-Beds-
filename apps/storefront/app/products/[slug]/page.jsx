// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import { notFound } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { stripInlineMarkdown } from "@big-eds/ui";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Price from "@/components/ui/Price";
import InlineMarkdown from "@/components/ui/InlineMarkdown";
import ProductCard from "@/components/home/ProductCard";
import ProductImageGallery from "@/components/products/ProductImageGallery";
import ProductGallerySection from "@/components/products/ProductGallerySection";
import ProductAttributes from "@/components/products/ProductAttributes";
import ProductPurchasePanel from "@/components/products/ProductPurchasePanel";
import { getProductBySlug, getProducts } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import { ApiClientError } from "@/lib/api/client";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) {
    return { title: "Product Not Found | Big Ed's Sofas & Beds" };
  }
  return {
    title: `${stripInlineMarkdown(product.name)} | Big Ed's Sofas & Beds`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;

  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const defaultVariant = product.variants.find((v) => v.isActive) ?? product.variants[0];
  const totalAvailable = defaultVariant?.availability?.totalAvailable ?? 0;
  const locationNames = (defaultVariant?.availability?.byLocation ?? [])
    .filter((l) => l.availableToSell > 0)
    .map((l) => l.locationName);
  const inStock = totalAvailable > 0;
  const plainName = stripInlineMarkdown(product.name);

  const related = product.category
    ? (await getProducts({ category: product.category.slug, pageSize: 5 })).products
        .filter((p) => p.id !== product.id)
        .slice(0, 4)
        .map(normalizeProductForCard)
    : [];

  return (
    <div className="pb-10">
      <Container className="pt-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop All", href: "/shop" },
            ...(product.category ? [{ label: product.category.name, href: `/shop/${product.category.slug}` }] : []),
            { label: plainName },
          ]}
        />
      </Container>

      <Container className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductImageGallery images={product.images} name={plainName} inStock={inStock} />

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">
              <InlineMarkdown text={product.name} />
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-charcoal/50">
              SKU: {defaultVariant?.sku}
            </p>
          </div>

          <Price
            price={defaultVariant ? defaultVariant.priceCents / 100 : 0}
            compareAtPrice={defaultVariant?.compareAtCents ? defaultVariant.compareAtCents / 100 : null}
          />

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
                ? `In stock — ${locationNames.join(" & ")}`
                : "Currently out of stock — check back soon"}
              {inStock && totalAvailable <= 2 && " (limited quantity available)"}
            </span>
          </div>

          <ProductAttributes product={product} />

          {defaultVariant?.dimensions && (
            <dl className="grid grid-cols-3 gap-3 rounded-xl border border-brand-charcoal/10 bg-white p-4 text-center">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">Width</dt>
                <dd className="mt-1 text-sm font-bold text-brand-charcoal">
                  {defaultVariant.dimensions.widthInches}&quot;
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">Height</dt>
                <dd className="mt-1 text-sm font-bold text-brand-charcoal">
                  {defaultVariant.dimensions.heightInches}&quot;
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-charcoal/50">Depth</dt>
                <dd className="mt-1 text-sm font-bold text-brand-charcoal">
                  {defaultVariant.dimensions.depthInches}&quot;
                </dd>
              </div>
            </dl>
          )}

          <ProductPurchasePanel product={product} />
        </div>
      </Container>

      {product.description && (
        <Container className="mt-10">
          <h2 className="font-display text-xl font-semibold text-brand-charcoal sm:text-2xl">Description</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-charcoal/75 sm:text-base">
            {product.description}
          </p>
        </Container>
      )}

      {product.images.length > 0 && (
        <Container className="mt-10">
          <h2 className="font-display text-xl font-semibold text-brand-charcoal sm:text-2xl">Gallery</h2>
          <div className="mt-5">
            <ProductGallerySection images={product.images} name={plainName} />
          </div>
        </Container>
      )}

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
