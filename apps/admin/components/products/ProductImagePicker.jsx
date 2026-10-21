"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Link2, Upload, X, GripVertical } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";

let nextImageKeyId = 0;

// First image is the hero/thumbnail-strip lead shown on the storefront
// product page; the rest fill the thumbnail strip and the gallery section
// below it — see apps/storefront/app/products/[slug]/page.jsx.
export default function ProductImagePicker({ images, onChange }) {
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      setUrlError("Enter a full image URL, e.g. https://example.com/image.jpg");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setUrlError("URL must start with http:// or https://");
      return;
    }
    setUrlError(null);
    // Each image gets a stable _key at creation time (stripped before
    // submit) rather than keyed by array index — keying by index breaks on
    // reorder, since the index a given image sits at changes on every move,
    // which left position badges (#1/#2/#3) stuck showing stale values even
    // though the underlying order had actually changed correctly.
    onChange([...images, { url, altText: null, _key: `img-${nextImageKeyId++}` }]);
    setUrlInput("");
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      const data = await api.upload("/catalog/admin/images", formData);
      onChange([...images, ...data.images.map((img) => ({ ...img, _key: `img-${nextImageKeyId++}` }))]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAt(index) {
    onChange(images.filter((_, i) => i !== index));
  }

  function moveTo(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            if (urlError) setUrlError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="https://example.com/image.jpg"
          className="min-w-0 rounded-lg border border-black/15 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red sm:flex-1 sm:py-2"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addUrl}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/15 px-3 py-2.5 text-sm font-semibold text-brand-charcoal hover:bg-black/5 sm:flex-none sm:py-2"
          >
            <Link2 className="size-4" aria-hidden="true" />
            Add URL
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/15 px-3 py-2.5 text-sm font-semibold text-brand-charcoal hover:bg-black/5 disabled:opacity-50 sm:flex-none sm:py-2"
          >
            <Upload className="size-4" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload from device"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      {urlError && <p className="text-sm text-red-600">{urlError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {images.map((img, index) => (
            <div key={img._key ?? `${img.url}-${index}`} className="flex flex-col gap-1.5">
              <div className="relative overflow-hidden rounded-lg border border-black/10">
                <div className="relative aspect-square bg-black/5">
                  <Image src={img.url} alt="" fill sizes="200px" className="object-cover" unoptimized />
                </div>
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {index === 0 ? "Hero" : `#${index + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label="Remove image"
                  className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveTo(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Move earlier"
                  className="flex size-9 items-center justify-center rounded-lg border border-black/15 text-brand-charcoal hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <GripVertical className="size-4 -rotate-90" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTo(index, index + 1)}
                  disabled={index === images.length - 1}
                  aria-label="Move later"
                  className="flex size-9 items-center justify-center rounded-lg border border-black/15 text-brand-charcoal hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <GripVertical className="size-4 rotate-90" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
