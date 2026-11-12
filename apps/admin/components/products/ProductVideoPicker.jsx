"use client";

import { useRef, useState } from "react";
import { Link2, Upload, X, GripVertical, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";

let nextVideoKeyId = 0;

// Mirrors ProductImagePicker.jsx exactly (same dual add-by-URL/upload-from-
// device flow, same drag-reorder + move-button fallback for touch, same
// _key/strip-before-submit convention) — see that file for the reasoning
// behind each piece. The only real differences are the upload endpoint,
// accepted file types, and rendering a <video> tile instead of an <Image>.
export default function ProductVideoPicker({ videos, onChange }) {
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const fileInputRef = useRef(null);

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      setUrlError("Enter a full video URL, e.g. https://example.com/video.mp4");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setUrlError("URL must start with http:// or https://");
      return;
    }
    setUrlError(null);
    onChange([...videos, { url, _key: `vid-${nextVideoKeyId++}` }]);
    setUrlInput("");
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("videos", file));
      const data = await api.upload("/catalog/admin/videos", formData);
      onChange([...videos, ...data.videos.map((v) => ({ ...v, _key: `vid-${nextVideoKeyId++}` }))]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAt(index) {
    onChange(videos.filter((_, i) => i !== index));
  }

  function moveTo(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= videos.length || fromIndex === toIndex) return;
    const next = [...videos];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  function handleDragStart(index) {
    setDragIndex(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (index !== dragOverIndex) setDragOverIndex(index);
  }

  function handleDrop(index) {
    if (dragIndex !== null) moveTo(dragIndex, index);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
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
          placeholder="https://example.com/video.mp4"
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
          accept="video/mp4,video/webm,video/quicktime"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      {urlError && <p className="text-sm text-red-600">{urlError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {videos.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {videos.map((vid, index) => (
            <div
              key={vid._key ?? `${vid.url}-${index}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`relative cursor-grab overflow-hidden rounded-lg border active:cursor-grabbing ${
                dragOverIndex === index && dragIndex !== index
                  ? "border-brand-red border-dashed"
                  : "border-black/10"
              } ${dragIndex === index ? "opacity-40" : ""}`}
            >
              <div className="relative flex aspect-square items-center justify-center bg-black/80">
                <video src={vid.url} className="size-full object-cover" muted playsInline preload="metadata" />
                <span className="pointer-events-none absolute flex size-9 items-center justify-center rounded-full bg-black/50 text-white">
                  <Play className="size-4" aria-hidden="true" fill="currentColor" />
                </span>
              </div>
              <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {index === 0 ? "Hero" : `#${index + 1}`}
              </span>
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white sm:hidden">
                <GripVertical className="size-4" aria-hidden="true" />
              </span>
              <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => moveTo(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Move left"
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTo(index, index + 1)}
                  disabled={index === videos.length - 1}
                  aria-label="Move right"
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Remove video"
                className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
