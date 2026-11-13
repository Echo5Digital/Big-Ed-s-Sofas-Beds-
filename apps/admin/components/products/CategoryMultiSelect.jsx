"use client";

import { useState } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import Button from "@/components/ui/Button";

// Same slugify as apps/admin/app/products/new/page.jsx and [id]/page.jsx —
// duplicated rather than shared, matching how those two already duplicate it
// between themselves.
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Same field-error surfacing as new/page.jsx's describeApiError —
// ApiClientError.message is the generic "Validation failed" for a 422; the
// useful message (e.g. a ConflictError's "A category with this slug already
// exists") is either in .message directly (ConflictError/NotFoundError) or
// buried in .details.fieldErrors (Zod validation failures).
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

// Inline "create a child category under this parent" form, shown under a
// top-level category's checkbox once its "+" is clicked. Categories are only
// ever two levels deep (see apps/storefront/lib/categoryTree.js) — this form
// only ever creates a child of a top-level category, never a grandchild and
// never a new top-level category itself (confirmed product decision).
//
// Two steps, not one: typing a name doesn't call the API directly — "Save"
// first moves to a review step showing exactly what will be created (name,
// slug, parent). Only confirming there actually creates it; "Edit" goes
// back to the name input (keeping what was typed) instead of discarding it,
// so a typo doesn't mean starting over. A category create can't be undone
// from this UI (no DELETE /categories endpoint exists), so this review step
// is the only safety net against creating the wrong one by mistake.
//
// Renders as a <div>, not a <form>: both admin product pages (new/[id])
// already wrap their entire Category tab — this component included — in one
// outer <form onSubmit={handleSubmit}>, and HTML forbids a nested <form>
// (React warns and the browser silently drops the inner one, breaking
// hydration). Every button here is type="button" with its own onClick for
// the same reason — a type="submit" button would submit the OUTER product
// form instead of (or in addition to) running this one's own handler.
function NewChildCategoryForm({ parent, onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [step, setStep] = useState("edit"); // "edit" | "confirm"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const slug = slugify(name);

  function handleReview() {
    if (!slug) {
      setError("name: Required");
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const { category } = await api.post("/catalog/categories", { name: name.trim(), slug, parentId: parent.id });
      onCreated(category);
    } catch (err) {
      setError(describeApiError(err, "Failed to create category"));
      setStep("edit");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e) {
    // Enter in a plain input inside the outer <form> would otherwise submit
    // THAT form (the whole product), not just advance to the review step.
    if (e.key === "Enter") {
      e.preventDefault();
      handleReview();
    }
  }

  if (step === "confirm") {
    return (
      <div className="ml-0 flex flex-col gap-2 rounded-lg border border-brand-gold-dark/30 bg-brand-gold/10 p-2.5 sm:ml-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />
          <p className="text-xs font-semibold text-brand-charcoal">
            This creates a new category that will appear across the entire site. Confirm the details
            below are correct before adding it.
          </p>
        </div>
        <dl className="flex flex-col gap-1 text-xs text-brand-charcoal/80">
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="font-semibold">Name:</dt>
            <dd className="wrap-break-word">{name.trim()}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="font-semibold">Slug:</dt>
            <dd className="break-all">{slug}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="font-semibold">Parent:</dt>
            <dd className="wrap-break-word">{parent.name}</dd>
          </div>
        </dl>
        {error && <p className="text-xs text-brand-red">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" size="sm" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Saving…" : "Yes, add it"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setStep("edit")} disabled={submitting}>
            Edit
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-0 flex flex-col gap-1.5 rounded-lg border border-black/10 bg-black/2 p-2.5 sm:ml-6">
      <label className="flex flex-col gap-1 text-xs font-medium text-brand-charcoal">
        New category under {parent.name}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Category name"
          className="rounded-lg border border-black/15 px-2.5 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </label>
      {slug && <p className="text-xs text-brand-charcoal/50">Slug: {slug}</p>}
      {error && <p className="text-xs text-brand-red">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="sm" onClick={handleReview} disabled={!name.trim()}>
          Review
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Groups flat Category rows (parent + children via parentId, see
// packages/database/prisma/schema.prisma) into sections for checkbox
// selection. The first checked category becomes the product's primary
// categoryId; any additional checked categories become secondary
// ProductCategory tags.
export default function CategoryMultiSelect({ categories, selectedIds, onChange, onCategoryCreated }) {
  const [addingMode, setAddingMode] = useState(false);
  const [creatingUnderId, setCreatingUnderId] = useState(null);

  const roots = categories.filter((c) => !c.parentId);
  const childrenByParent = categories.reduce((acc, c) => {
    if (c.parentId) (acc[c.parentId] ??= []).push(c);
    return acc;
  }, {});

  function toggle(id) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function handleCreated(category) {
    setCreatingUnderId(null);
    onCategoryCreated?.(category);
    // Staff just created this category specifically to tag the product
    // they're editing — auto-check it rather than leaving them to find and
    // re-click it in the tree.
    onChange([...selectedIds, category.id]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-brand-charcoal/60">
        The first category checked is the product&rsquo;s primary category. Check any others to also
        list it on those category pages.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {roots.map((root) => (
          <div key={root.id} className="flex flex-col gap-1.5 rounded-lg border border-black/10 p-3">
            <div className="flex min-h-9 items-center justify-between gap-2 py-1.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-charcoal">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(root.id)}
                  onChange={() => toggle(root.id)}
                  className="size-4 rounded border-black/30 text-brand-red focus:ring-brand-red"
                />
                {root.name}
              </label>
              {addingMode && creatingUnderId !== root.id && (
                <button
                  type="button"
                  onClick={() => setCreatingUnderId(root.id)}
                  aria-label={`Add a new category under ${root.name}`}
                  title={`Add a new category under ${root.name}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-brand-charcoal/60 hover:bg-brand-red/10 hover:text-brand-red"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {(childrenByParent[root.id] ?? []).map((child) => (
              <label key={child.id} className="ml-6 flex min-h-9 items-center gap-2 py-1.5 text-sm text-brand-charcoal/80">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(child.id)}
                  onChange={() => toggle(child.id)}
                  className="size-4 rounded border-black/30 text-brand-red focus:ring-brand-red"
                />
                {child.name}
              </label>
            ))}
            {creatingUnderId === root.id && (
              <NewChildCategoryForm
                parent={root}
                onCancel={() => setCreatingUnderId(null)}
                onCreated={handleCreated}
              />
            )}
          </div>
        ))}
      </div>
      <div>
        <button
          type="button"
          onClick={() => setAddingMode((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-red hover:text-brand-red-dark"
        >
          {addingMode ? (
            <>
              <X className="size-3.5" aria-hidden="true" />
              Done adding categories
            </>
          ) : (
            <>
              <Plus className="size-3.5" aria-hidden="true" />
              Add new category
            </>
          )}
        </button>
      </div>
    </div>
  );
}
