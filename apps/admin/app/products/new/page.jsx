"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/layout/RequireAuth";
import { useAuth } from "@/lib/hooks/useAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProductNameInput from "@/components/products/ProductNameInput";
import ProductImagePicker from "@/components/products/ProductImagePicker";
import ProductVideoPicker from "@/components/products/ProductVideoPicker";
import CategoryMultiSelect from "@/components/products/CategoryMultiSelect";
import ProductInitialStockInputs from "@/components/products/ProductInitialStockInputs";
import LinkedProductPicker from "@/components/products/LinkedProductPicker";
import ProductFormTabs from "@/components/products/ProductFormTabs";
import FormField, { fieldInputClass } from "@/components/products/FormField";
import { api, ApiClientError } from "@/lib/api/client";

const TABS = [
  { key: "general", label: "General" },
  { key: "inventory", label: "Inventory" },
  { key: "category", label: "Category" },
  { key: "attributes", label: "Attributes" },
  { key: "linked", label: "Linked Products" },
];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ApiClientError.message is always the generic "Validation failed" for a 422
// (see apps/api/src/lib/errors.js ValidationError) — the actual failing
// field lives in .details, a Zod .flatten() object. Surfacing it here is
// what would have told staff immediately that "Dimensions" (not the
// category) was the problem, instead of a dead-end generic message.
function describeApiError(err, fallback) {
  const fieldErrors = err instanceof ApiClientError ? err.details?.fieldErrors : null;
  if (fieldErrors) {
    const firstEntry = Object.entries(fieldErrors).find(([, messages]) => messages?.length);
    if (firstEntry) {
      const [field, messages] = firstEntry;
      return `${field}: ${messages[0]}`;
    }
  }
  return err instanceof ApiClientError ? err.message : fallback;
}

function NewProductContent() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canViewCost = hasPermission("catalog:cost:view");
  const [tab, setTab] = useState("general");
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stockQuantities, setStockQuantities] = useState({});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [categoryIds, setCategoryIds] = useState([]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [sku, setSku] = useState("");
  const [costCents, setCostCents] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [compareAtCents, setCompareAtCents] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState("8.25");
  const [itemName, setItemName] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [linkedProducts, setLinkedProducts] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getCached("/catalog/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    api
      .getCached("/inventory/locations")
      .then((data) => setLocations(data.locations.filter((l) => l.isActive)))
      .catch(() => setLocations([]));
  }, []);

  function handleNameChange(value) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (compareAtCents !== "" && Number(compareAtCents) < Number(priceCents)) {
      setError("Original Price must be greater than or equal to the Sale Price.");
      setSubmitting(false);
      setTab("general");
      return;
    }

    try {
      // The first checked category is the primary categoryId; the rest ride
      // along as categoryIds — the API dedupes and stores them in the
      // ProductCategory join table. See catalog.routes.js POST /products.
      const [primaryCategoryId, ...secondaryCategoryIds] = categoryIds;

      // Entirely optional: blank/zero counts are simply omitted, so a
      // product can be created with no stock and received later as normal.
      const initialStock = Object.fromEntries(
        Object.entries(stockQuantities)
          .map(([locationId, value]) => [locationId, Number(value)])
          .filter(([, qty]) => Number.isInteger(qty) && qty > 0)
      );

      await api.post("/catalog/products", {
        name,
        slug,
        categoryId: primaryCategoryId || undefined,
        categoryIds: secondaryCategoryIds,
        description: description || undefined,
        status,
        itemName: itemName || undefined,
        color: color || undefined,
        material: material || undefined,
        dimensions: dimensions || undefined,
        images: images.length ? images.map(({ url, publicId, altText }) => ({ url, publicId, altText })) : undefined,
        videos: videos.length ? videos.map(({ url, publicId }) => ({ url, publicId })) : undefined,
        // One sellable variant per product today — no separate "variant"
        // concept is exposed in this form, so its name mirrors the product
        // name (the API still requires every product to have a variant).
        variants: [
          {
            sku,
            name,
            priceCents: Math.round(Number(priceCents) * 100),
            compareAtCents: compareAtCents !== "" ? Math.round(Number(compareAtCents) * 100) : undefined,
            costCents: canViewCost && costCents !== "" ? Math.round(Number(costCents) * 100) : undefined,
            taxRatePercent: taxRatePercent !== "" ? Number(taxRatePercent) : undefined,
          },
        ],
        linkedProductIds: linkedProducts.length ? linkedProducts.map((p) => p.id) : undefined,
        initialStock: Object.keys(initialStock).length ? initialStock : undefined,
      });
      router.push("/products");
    } catch (err) {
      setError(describeApiError(err, "Failed to create product."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Product" subtitle="Add a product to the catalog" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-6 sm:flex-row">
          <ProductFormTabs tabs={TABS} active={tab} onChange={setTab} />

          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:min-h-125">
            {tab === "general" && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-base font-bold text-brand-charcoal">General</h2>

                <ProductNameInput id="name" value={name} onChange={handleNameChange} />

                <FormField id="slug" label="URL slug">
                  <input
                    id="slug"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    className={`${fieldInputClass} font-mono`}
                  />
                </FormField>

                <FormField id="primarySku" label="SKU">
                  <input
                    id="primarySku"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={`${fieldInputClass} font-mono`}
                  />
                </FormField>

                <FormField id="status" label="Status">
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={fieldInputClass}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </FormField>

                <FormField id="description" label="Description">
                  <textarea
                    id="description"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-brand-charcoal">Images</span>
                  <p className="text-xs text-brand-charcoal/60">
                    The first image is the hero/thumbnail shown when buying; all images also appear in
                    the gallery section below the description.
                  </p>
                  <ProductImagePicker images={images} onChange={setImages} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-brand-charcoal">Videos</span>
                  <p className="text-xs text-brand-charcoal/60">
                    Add by URL or upload from your device, same as images — drag to reorder, or use the
                    arrow buttons on touch devices.
                  </p>
                  <ProductVideoPicker videos={videos} onChange={setVideos} />
                </div>
              </div>
            )}

            {tab === "inventory" && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-base font-bold text-brand-charcoal">Inventory</h2>

                {canViewCost && (
                  <FormField
                    id="purchasePrice"
                    label="Purchase Price (USD)"
                    hint="What we pay the manufacturer — not shown to customers."
                  >
                    <input
                      id="purchasePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={costCents}
                      onChange={(e) => setCostCents(e.target.value)}
                      className={fieldInputClass}
                    />
                  </FormField>
                )}

                <FormField id="compareAtPrice" label="Original Price (USD)" hint="Optional — shown struck through.">
                  <input
                    id="compareAtPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={compareAtCents}
                    onChange={(e) => setCompareAtCents(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <FormField id="primaryPrice" label="Sale Price (USD)">
                  <input
                    id="primaryPrice"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceCents}
                    onChange={(e) => setPriceCents(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <FormField id="taxRate" label="Tax (%)" hint="Sales tax rate applied to this product.">
                  <input
                    id="taxRate"
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <p className="text-xs text-brand-charcoal/60">
                  Optional. Enter an on-hand count for any location to receive stock immediately — this
                  creates a real stock receipt, the same as using Adjust on the Inventory page. Leave
                  blank to create the product with no stock and receive it later.
                </p>
                <ProductInitialStockInputs
                  locations={locations}
                  quantities={stockQuantities}
                  onChange={setStockQuantities}
                />
              </div>
            )}

            {tab === "category" && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-base font-bold text-brand-charcoal">Category</h2>
                <CategoryMultiSelect categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
              </div>
            )}

            {tab === "attributes" && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-base font-bold text-brand-charcoal">Attributes</h2>
                <p className="text-xs text-brand-charcoal/60">
                  Shown on the storefront product page. Leave any blank to hide it from the live page.
                </p>

                <FormField id="itemName" label="Item Name">
                  <input
                    id="itemName"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <FormField id="itemColor" label="Color">
                  <input
                    id="itemColor"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <FormField id="material" label="Material">
                  <input
                    id="material"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <FormField id="itemDimensions" label="Dimensions">
                  <input
                    id="itemDimensions"
                    placeholder={'e.g. 84"W x 38"D x 36"H'}
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    maxLength={160}
                    className={fieldInputClass}
                  />
                </FormField>
              </div>
            )}

            {tab === "linked" && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-base font-bold text-brand-charcoal">Linked Products</h2>
                <p className="text-xs text-brand-charcoal/60">
                  Other, separately-sold products to show as options on this product&rsquo;s storefront
                  page (e.g. a matching loveseat for a sectional). Linking is automatic both ways — no
                  need to also edit the other product.
                </p>
                <LinkedProductPicker linkedProducts={linkedProducts} onChange={setLinkedProducts} />
              </div>
            )}
          </div>
        </Card>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Create Product"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/products")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <RequireAuth permission="catalog:write">
      <NewProductContent />
    </RequireAuth>
  );
}
