"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RequireAuth from "@/components/layout/RequireAuth";
import { useAuth } from "@/lib/hooks/useAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProductNameInput from "@/components/products/ProductNameInput";
import ProductImagePicker from "@/components/products/ProductImagePicker";
import ProductVideoPicker from "@/components/products/ProductVideoPicker";
import CategoryMultiSelect from "@/components/products/CategoryMultiSelect";
import LinkedProductPicker from "@/components/products/LinkedProductPicker";
import ProductFormTabs from "@/components/products/ProductFormTabs";
import ProductSupplierSelect from "@/components/products/ProductSupplierSelect";
import ProductWarrantyFields from "@/components/products/ProductWarrantyFields";
import FormField, { fieldInputClass } from "@/components/products/FormField";
import { api, ApiClientError } from "@/lib/api/client";

const TABS = [
  { key: "general", label: "General" },
  { key: "inventory", label: "Inventory" },
  { key: "category", label: "Category" },
  { key: "attributes", label: "Attributes" },
  { key: "linked", label: "Linked Products" },
  { key: "warranty", label: "Warranty" },
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
// field lives in .details, a Zod .flatten() object.
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

function EditProductContent() {
  const router = useRouter();
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canViewCost = hasPermission("catalog:cost:view");
  const [tab, setTab] = useState("general");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryIds, setCategoryIds] = useState([]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [variantId, setVariantId] = useState(null);
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [currentSupplier, setCurrentSupplier] = useState(null);
  const [isWarrantied, setIsWarrantied] = useState(false);
  const [warrantyNote, setWarrantyNote] = useState("");
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
      .get(`/catalog/admin/products/${id}`)
      .then((data) => {
        const product = data.product;
        const variant = product.variants[0];
        setName(product.name);
        setSlug(product.slug);
        setDescription(product.description ?? "");
        setStatus(product.status);
        setVariantId(variant?.id ?? null);
        setSku(variant?.sku ?? "");
        setBrand(product.brand ?? "");
        setSupplierId(product.supplierId ?? "");
        setCurrentSupplier(product.supplier ?? null);
        setIsWarrantied(Boolean(product.isWarrantied));
        setWarrantyNote(product.warrantyNote ?? "");
        setCostCents(variant?.costCents ? (variant.costCents / 100).toString() : "");
        setPriceCents(variant ? (variant.priceCents / 100).toString() : "");
        setCompareAtCents(variant?.compareAtCents ? (variant.compareAtCents / 100).toString() : "");
        setTaxRatePercent(variant?.taxRatePercent != null ? variant.taxRatePercent.toString() : "8.25");
        setItemName(product.itemName ?? "");
        setColor(product.color ?? "");
        setMaterial(product.material ?? "");
        setDimensions(product.dimensions ?? "");
        // _key gives each image a stable React key independent of its array
        // index — see ProductImagePicker.jsx for why index-based keys break
        // position badges across a reorder. Stripped before submit below.
        setImages(
          product.images.map((img, i) => ({
            url: img.url,
            publicId: img.publicId,
            altText: img.altText,
            _key: `loaded-${i}`,
          }))
        );
        setVideos(
          (product.videos ?? []).map((vid, i) => ({
            url: vid.url,
            publicId: vid.publicId,
            _key: `loaded-${i}`,
          }))
        );
        // Primary category first, then any secondary tags — mirrors how the
        // New Product form reads this same list back apart on submit.
        setCategoryIds([
          ...(product.category ? [product.category.id] : []),
          ...product.categories.map((c) => c.id),
        ]);
        setLinkedProducts(product.linkedProducts ?? []);
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(err instanceof ApiClientError ? err.message : "Failed to load product.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleNameChange(value) {
    setName(value);
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
      const [primaryCategoryId, ...secondaryCategoryIds] = categoryIds;

      await api.patch(`/catalog/products/${id}`, {
        name,
        slug,
        categoryId: primaryCategoryId || null,
        categoryIds: secondaryCategoryIds,
        description: description || null,
        status,
        brand: brand.trim() || null,
        supplierId: supplierId || null,
        isWarrantied,
        warrantyNote: isWarrantied ? warrantyNote.trim() || null : null,
        itemName: itemName || null,
        color: color || null,
        material: material || null,
        dimensions: dimensions || null,
        images: images.map(({ url, publicId, altText }) => ({ url, publicId, altText })),
        videos: videos.map(({ url, publicId }) => ({ url, publicId })),
        variants: [
          {
            id: variantId,
            sku,
            name,
            priceCents: Math.round(Number(priceCents) * 100),
            compareAtCents: compareAtCents !== "" ? Math.round(Number(compareAtCents) * 100) : null,
            // Omitted entirely (not sent as null) when the signed-in user can't
            // view/edit cost — leaves the existing costCents untouched server-
            // side rather than risking this form silently wiping it for a role
            // that never saw the field to begin with.
            costCents: canViewCost ? (costCents !== "" ? Math.round(Number(costCents) * 100) : null) : undefined,
            taxRatePercent: taxRatePercent !== "" ? Number(taxRatePercent) : undefined,
          },
        ],
        // Full replace, same convention as categoryIds above — always sends
        // the complete current list, even empty, so removing the last linked
        // product actually clears it instead of being silently skipped.
        linkedProductIds: linkedProducts.map((p) => p.id),
      });
      router.push("/products");
    } catch (err) {
      setError(describeApiError(err, "Failed to save product."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-charcoal/60">Loading…</p>;
  }

  if (notFound) {
    return (
      <div>
        <PageHeader title="Product not found" />
        <p className="text-sm text-brand-charcoal/60">
          This product doesn&apos;t exist or may have been removed.{" "}
          <button type="button" onClick={() => router.push("/products")} className="font-semibold text-brand-red hover:text-brand-red-dark">
            Back to Products
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Edit Product" subtitle={name} />

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
                    onChange={(e) => setSlug(slugify(e.target.value))}
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

                <FormField id="brand" label="Brand" hint="Internal only — not shown to customers.">
                  <input
                    id="brand"
                    maxLength={120}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>

                <ProductSupplierSelect value={supplierId} onChange={setSupplierId} currentSupplier={currentSupplier} />

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
                  Showroom and Warehouse on-hand counts are managed from the Inventory page&rsquo;s
                  Adjust and Transfer actions, so stock movements stay recorded as proper stock receipts
                  for this product&rsquo;s variant.
                </p>
              </div>
            )}

            {tab === "category" && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-base font-bold text-brand-charcoal">Category</h2>
                <CategoryMultiSelect
                  categories={categories}
                  selectedIds={categoryIds}
                  onChange={setCategoryIds}
                  onCategoryCreated={(category) => setCategories((prev) => [...prev, category])}
                />
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
                <LinkedProductPicker linkedProducts={linkedProducts} onChange={setLinkedProducts} excludeProductId={id} />
              </div>
            )}

            {tab === "warranty" && (
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-base font-bold text-brand-charcoal">Warranty</h2>
                <ProductWarrantyFields
                  isWarrantied={isWarrantied}
                  onToggle={setIsWarrantied}
                  note={warrantyNote}
                  onNoteChange={setWarrantyNote}
                />
              </div>
            )}
          </div>
        </Card>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/products")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <RequireAuth permission="catalog:write">
      <EditProductContent />
    </RequireAuth>
  );
}
