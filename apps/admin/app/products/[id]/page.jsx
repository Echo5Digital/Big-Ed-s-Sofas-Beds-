"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProductNameInput from "@/components/products/ProductNameInput";
import ProductImagePicker from "@/components/products/ProductImagePicker";
import CategoryMultiSelect from "@/components/products/CategoryMultiSelect";
import { api, ApiClientError } from "@/lib/api/client";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function EditProductContent() {
  const router = useRouter();
  const { id } = useParams();
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
      .get("/catalog/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    // No GET-by-id admin endpoint exists yet — reuse the same admin product
    // list the /products page already fetches and find this one client-side.
    api
      .get("/catalog/admin/products")
      .then((data) => {
        const product = data.products.find((p) => p.id === id);
        if (!product) {
          setNotFound(true);
          return;
        }
        const variant = product.variants[0];
        setName(product.name);
        setSlug(product.slug);
        setDescription(product.description ?? "");
        setStatus(product.status);
        setVariantId(variant?.id ?? null);
        setSku(variant?.sku ?? "");
        setPriceCents(variant ? (variant.priceCents / 100).toString() : "");
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
        // Primary category first, then any secondary tags — mirrors how the
        // New Product form reads this same list back apart on submit.
        setCategoryIds([
          ...(product.category ? [product.category.id] : []),
          ...product.categories.map((c) => c.id),
        ]);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load product."))
      .finally(() => setLoading(false));
  }, [id]);

  function handleNameChange(value) {
    setName(value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const [primaryCategoryId, ...secondaryCategoryIds] = categoryIds;

      await api.patch(`/catalog/products/${id}`, {
        name,
        slug,
        categoryId: primaryCategoryId || null,
        categoryIds: secondaryCategoryIds,
        description: description || null,
        status,
        itemName: itemName || null,
        color: color || null,
        material: material || null,
        dimensions: dimensions || null,
        images: images.map(({ url, publicId, altText }) => ({ url, publicId, altText })),
        variants: [{ id: variantId, sku, name, priceCents: Math.round(Number(priceCents) * 100) }],
      });
      router.push("/products");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save product.");
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
                onChange={(e) => setSlug(slugify(e.target.value))}
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
