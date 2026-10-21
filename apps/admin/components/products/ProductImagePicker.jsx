"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Link2, Upload, X, GripVertical } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";

// First image is the hero/thumbnail-strip lead shown on the storefront
// product page; the rest fill the thumbnail strip and the gallery section
// below it — see apps/storefront/app/products/[slug]/page.jsx.
export default function ProductImagePicker({ images, onChange }) {
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    onChange([...images, { url, altText: null }]);
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
      onChange([...images, ...data.images]);
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
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="https://example.com/image.jpg"
          className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <button
          type="button"
          onClick={addUrl}
          className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-sm font-semibold text-brand-charcoal hover:bg-black/5"
        >
          <Link2 className="size-4" aria-hidden="true" />
          Add URL
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-sm font-semibold text-brand-charcoal hover:bg-black/5 disabled:opacity-50"
        >
          <Upload className="size-4" aria-hidden="true" />
          {uploading ? "Uploading…" : "Upload from device"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, index) => (
            <div key={img.url + index} className="group relative overflow-hidden rounded-lg border border-black/10">
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
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-red-600"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
              <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => moveTo(index, index - 1)}
                    aria-label="Move earlier"
                    className="rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <GripVertical className="size-3.5 -rotate-90" aria-hidden="true" />
                  </button>
                )}
                {index < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveTo(index, index + 1)}
                    aria-label="Move later"
                    className="rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <GripVertical className="size-3.5 rotate-90" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
