"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProductNameInput from "@/components/products/ProductNameInput";
import ProductImagePicker from "@/components/products/ProductImagePicker";
import CategoryMultiSelect from "@/components/products/CategoryMultiSelect";
import ProductInitialStockInputs from "@/components/products/ProductInitialStockInputs";
import { api, ApiClientError } from "@/lib/api/client";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function NewProductContent() {
  const router = useRouter();
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
  const [priceCents, setPriceCents] = useState("");
  const [itemName, setItemName] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [images, setImages] = useState([]);
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
        // One sellable variant per product today — no separate "variant"
        // concept is exposed in this form, so its name mirrors the product
        // name (the API still requires every product to have a variant).
        variants: [{ sku, name, priceCents: Math.round(Number(priceCents) * 100) }],
        initialStock: Object.keys(initialStock).length ? initialStock : undefined,
      });
      router.push("/products");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Product" subtitle="Add a product to the catalog" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-base font-bold text-brand-charcoal">Basics</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProductNameInput id="name" value={name} onChange={handleNameChange} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="slug" className="text-sm font-medium text-brand-charcoal">
                URL slug
              </label>
              <input
                id="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm font-mono focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="primarySku" className="text-sm font-medium text-brand-charcoal">
                SKU
              </label>
              <input
                id="primarySku"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm font-mono focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="primaryPrice" className="text-sm font-medium text-brand-charcoal">
                Price (USD)
              </label>
              <input
                id="primaryPrice"
                required
                type="number"
                min="0"
                step="0.01"
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-sm font-medium text-brand-charcoal">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="itemName" className="text-sm font-medium text-brand-charcoal">
                Item Name
              </label>
              <input
                id="itemName"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="itemColor" className="text-sm font-medium text-brand-charcoal">
                Color
              </label>
              <input
                id="itemColor"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="material" className="text-sm font-medium text-brand-charcoal">
                Material
              </label>
              <input
                id="material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="itemDimensions" className="text-sm font-medium text-brand-charcoal">
                Dimensions
              </label>
              <input
                id="itemDimensions"
                placeholder={'e.g. 84"W x 38"D x 36"H'}
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
          </div>

          <p className="text-xs text-brand-charcoal/60">
            Item Name, Color, Material, and Dimensions are shown on the storefront product page. Leave
            any blank to hide it from the live page.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-brand-charcoal">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-brand-charcoal">Inventory</h2>
            <p className="text-xs text-brand-charcoal/60">
              Optional. Enter an on-hand count for any location to receive stock immediately — this
              creates a real stock receipt, the same as using Adjust on the Inventory page. Leave blank
              to create the product with no stock and receive it later.
            </p>
          </div>
          <ProductInitialStockInputs locations={locations} quantities={stockQuantities} onChange={setStockQuantities} />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-base font-bold text-brand-charcoal">Categories</h2>
          <CategoryMultiSelect categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-brand-charcoal">Images</h2>
            <p className="text-xs text-brand-charcoal/60">
              The first image is the hero/thumbnail shown when buying; all images also appear in the
              gallery section below the description.
            </p>
          </div>
          <ProductImagePicker images={images} onChange={setImages} />
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
