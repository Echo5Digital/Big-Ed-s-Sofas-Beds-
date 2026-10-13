"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PlusCircle } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api/client";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function emptyVariant() {
  return { sku: "", name: "", priceCents: "", color: "", size: "" };
}

function NewProductContent() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [variants, setVariants] = useState([emptyVariant()]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/catalog/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  function handleNameChange(value) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function updateVariant(index, field, value) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }

  function removeVariant(index) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.post("/catalog/products", {
        name,
        slug,
        brand: brand || undefined,
        categoryId: categoryId || undefined,
        description: description || undefined,
        status,
        variants: variants.map((v) => ({
          sku: v.sku,
          name: v.name,
          color: v.color || undefined,
          size: v.size || undefined,
          priceCents: Math.round(Number(v.priceCents) * 100),
        })),
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
      <PageHeader title="New Product" subtitle="Add a product and its sellable variants" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-brand-charcoal">
                Product name
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>

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
              <label htmlFor="brand" className="text-sm font-medium text-brand-charcoal">
                Brand
              </label>
              <input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium text-brand-charcoal">
                Category
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
          </div>

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
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-charcoal">Variants</h2>
            <Button type="button" variant="outline" size="sm" icon={PlusCircle} onClick={addVariant}>
              Add variant
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {variants.map((variant, index) => (
              <div key={index} className="grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-3 sm:grid-cols-6">
                <div className="col-span-2 flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-medium text-brand-charcoal/70">SKU</label>
                  <input
                    required
                    value={variant.sku}
                    onChange={(e) => updateVariant(index, "sku", e.target.value)}
                    className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm font-mono focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                  <label className="text-xs font-medium text-brand-charcoal/70">Variant name</label>
                  <input
                    required
                    value={variant.name}
                    onChange={(e) => updateVariant(index, "name", e.target.value)}
                    className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-brand-charcoal/70">Color</label>
                  <input
                    value={variant.color}
                    onChange={(e) => updateVariant(index, "color", e.target.value)}
                    className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-brand-charcoal/70">Size</label>
                  <input
                    value={variant.size}
                    onChange={(e) => updateVariant(index, "size", e.target.value)}
                    className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-brand-charcoal/70">Price (USD)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.priceCents}
                    onChange={(e) => updateVariant(index, "priceCents", e.target.value)}
                    className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div className="flex items-end justify-end">
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      aria-label="Remove variant"
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
    <RequireAuth>
      <NewProductContent />
    </RequireAuth>
  );
}
