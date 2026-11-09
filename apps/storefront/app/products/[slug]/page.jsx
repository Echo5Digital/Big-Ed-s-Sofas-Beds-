// Live catalog data, never stale-cached — see app/page.jsx for rationale.
export const instant = false;

import { notFound } from "next/navigation";
import { CheckCircle2, AlertCircle, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { stripInlineMarkdown } from "@big-eds/ui";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Price from "@/components/ui/Price";
import StarRating from "@/components/ui/StarRating";
import InlineMarkdown from "@/components/ui/InlineMarkdown";
import ProductCard from "@/components/home/ProductCard";
import ProductImageGallery from "@/components/products/ProductImageGallery";
import ProductAttributes from "@/components/products/ProductAttributes";
import ProductPurchasePanel from "@/components/products/ProductPurchasePanel";
import FrequentlyBoughtTogether from "@/components/products/FrequentlyBoughtTogether";
import { getProductBySlug, getProducts, getCategories } from "@/lib/api/catalog";
import { normalizeProductForCard } from "@/lib/api/normalize";
import {
  homepageDisplayRating,
  homepageDisplayReviewCount,
  shuffleProducts,
  withDisplayRating,
} from "@/lib/dailyRotation";
import { currentDaySeed } from "@/lib/currentDaySeed";
import { topLevelCategorySlugFor } from "@/lib/categoryTree";
import { pairedCategorySlugsFor } from "@/lib/categoryPairings";
import { ApiClientError } from "@/lib/api/client";

// Matches the trust-badge strip pattern on the reference sites (free
// delivery / easy returns / warranty) — informational only, not a new
// fulfillment or policy capability; copy mirrors what ProductPurchasePanel
// and /shipping-delivery, /returns already state elsewhere on the site.
const TRUST_BADGES = [
  { icon: Truck, label: "Local Delivery Available", detail: "Scheduling confirmed at checkout" },
  { icon: RotateCcw, label: "Easy Returns", detail: "See our returns policy for details" },
  { icon: ShieldCheck, label: "Quality Checked", detail: "Inspected before it leaves our warehouse" },
];

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) {
    return { title: "Product Not Found | Big Ed's Sofas & Beds" };
  }
  return {
    title: `${stripInlineMarkdown(product.name)} | Big Ed's Sofas & Beds`,
    description: product.description ? stripInlineMarkdown(product.description) : null,
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
  const inStock = totalAvailable > 0;
  // Matches the "limited quantity available" threshold this status previously
  // appended as a suffix to the in-stock message; now its own distinct state.
  const isLimitedStock = inStock && totalAvailable <= 2;
  const plainName = stripInlineMarkdown(product.name);

  const defaultPriceCents = defaultVariant?.priceCents ?? 0;
  const defaultCompareAtCents = defaultVariant?.compareAtCents ?? null;
  const discountPercent =
    defaultCompareAtCents && defaultCompareAtCents > defaultPriceCents
      ? Math.round(((defaultCompareAtCents - defaultPriceCents) / defaultCompareAtCents) * 100)
      : 0;

  // Pool is wider than the 4 actually shown (RELATED_POOL_SIZE, not pageSize:
  // 5) and then shuffled — fetching just enough for 4 and taking them
  // in server order meant every visitor to every product in a category saw
  // the exact same 4 "also like" picks forever (always the 4
  // oldest-by-createdAt in that category, since sort: "oldest" never
  // changes). Shuffling a real pool makes this section look alive and vary
  // day to day instead of being permanently pinned to old stock.
  const RELATED_POOL_SIZE = 20;
  const related = product.category
    ? shuffleProducts(
        (await getProducts({ category: product.category.slug, pageSize: RELATED_POOL_SIZE, sort: "oldest" })).products
          .filter((p) => p.id !== product.id),
        await currentDaySeed(),
        `related-${product.id}`
      )
        .slice(0, 4)
        .map(normalizeProductForCard)
        .map(withDisplayRating)
    : [];

  // Staff-curated cross-links to other, independently-sellable products (see
  // ProductLink in packages/database/prisma/schema.prisma) — distinct from
  // `related`/"You May Also Like" above, which is auto-computed from shared
  // category and not staff-controlled. Always symmetric server-side, so this
  // never needs to be set from both products' admin pages.
  const linkedProducts = (product.linkedProducts ?? []).map(normalizeProductForCard).map(withDisplayRating);

  // "Frequently Bought Together" deliberately pairs this product with OTHER-
  // category products (see lib/categoryPairings.js) — the opposite axis from
  // `related` above, which is same-category. One product is picked per
  // paired category (not a pool of many) to keep the bundle widget small and
  // scannable, same reasoning FBT widgets on reference sites use.
  const FBT_PICK_COUNT = 2;
  let frequentlyBoughtTogether = [];
  if (product.category) {
    const categories = await getCategories();
    const topLevelSlug = topLevelCategorySlugFor(product.category, categories);
    const pairedSlugs = pairedCategorySlugsFor(topLevelSlug).slice(0, FBT_PICK_COUNT);
    const daySeed = await currentDaySeed();

    const picks = (
      await Promise.all(
        pairedSlugs.map(async (slug) => {
          const { products: candidates } = await getProducts({ category: slug, pageSize: 20, sort: "oldest" });
          const inStockCandidates = candidates.filter((p) => p.id !== product.id);
          if (inStockCandidates.length === 0) return null;
          return shuffleProducts(inStockCandidates, daySeed, `fbt-${product.id}-${slug}`)[0];
        })
      )
    ).filter(Boolean);

    if (picks.length > 0) {
      frequentlyBoughtTogether = [product, ...picks].map(normalizeProductForCard).map(withDisplayRating);
    }
  }

  const displayRating = homepageDisplayRating(product.id);
  const displayReviewCount = homepageDisplayReviewCount(product.id);

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

      <Container className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        <ProductImageGallery
          images={product.images}
          name={plainName}
          inStock={inStock}
          discountPercent={discountPercent}
        />

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">
              <InlineMarkdown text={product.name} />
            </h1>
            <div className="mt-2">
              <StarRating rating={displayRating} reviewCount={displayReviewCount} showValue />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-brand-charcoal/10 pb-4">
            <Price
              price={defaultVariant ? defaultVariant.priceCents / 100 : 0}
              compareAtPrice={defaultVariant?.compareAtCents ? defaultVariant.compareAtCents / 100 : null}
              showDiscount
            />
            <p className="text-xs font-medium uppercase tracking-wide text-brand-charcoal/50">
              SKU: {defaultVariant?.sku}
            </p>
          </div>

          <div
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
              isLimitedStock
                ? "border-brand-gold-dark/30 bg-brand-gold/10 text-brand-gold-dark"
                : inStock
                  ? "border-green-600/20 bg-green-600/5 text-green-800"
                  : "border-brand-red/20 bg-brand-red/5 text-brand-red-dark"
            }`}
          >
            {inStock ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span>{isLimitedStock ? "Limited Stock" : inStock ? "In Stock" : "Out of Stock"}</span>
          </div>

          <ProductAttributes product={product} />

          <ProductPurchasePanel product={product} />

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-brand-charcoal/10 bg-brand-cream/60 p-4 sm:grid-cols-3">
            {TRUST_BADGES.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-red-dark" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-brand-charcoal">{label}</p>
                  <p className="text-xs text-brand-charcoal/60">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          {linkedProducts.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-brand-charcoal/10 pt-4">
              <h2 className="text-sm font-semibold text-brand-charcoal">Available As</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {linkedProducts.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Container>

      {frequentlyBoughtTogether.length > 1 && (
        <Container className="mt-10">
          <h2 className="font-display text-xl font-semibold text-brand-charcoal sm:text-2xl">
            Frequently Bought Together
          </h2>
          <div className="mt-5">
            <FrequentlyBoughtTogether items={frequentlyBoughtTogether} />
          </div>
        </Container>
      )}

      {product.description && (
        <Container className="mt-10">
          <h2 className="font-display text-xl font-semibold text-brand-charcoal sm:text-2xl">Description</h2>
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-brand-charcoal/75 sm:text-base">
            <InlineMarkdown text={product.description} />
          </p>
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
