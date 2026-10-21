"use client";

import { useRef } from "react";
import { Bold, Italic } from "lucide-react";
import InlineMarkdown from "@/components/ui/InlineMarkdown";

// Wraps the current text selection in ** or _ markers, matching the
// lightweight inline-markdown subset packages/ui's parseInlineMarkdown reads
// back on render. Plain string storage, no HTML — see that module for why.
function wrapSelection(value, selectionStart, selectionEnd, marker) {
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  if (!selected) return { value, cursor: selectionStart };
  const wrapped = `${marker}${selected}${marker}`;
  return { value: `${before}${wrapped}${after}`, cursor: before.length + wrapped.length };
}

export default function ProductNameInput({ id, value, onChange }) {
  const inputRef = useRef(null);

  function applyMarker(marker) {
    const el = inputRef.current;
    if (!el) return;
    const { value: nextValue, cursor } = wrapSelection(value, el.selectionStart, el.selectionEnd, marker);
    onChange(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-brand-charcoal">
          Product name
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyMarker("**")}
            aria-label="Bold selected text"
            title="Bold selected text"
            className="rounded p-1 text-brand-charcoal/70 hover:bg-black/5 hover:text-brand-charcoal"
          >
            <Bold className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => applyMarker("_")}
            aria-label="Italicize selected text"
            title="Italicize selected text"
            className="rounded p-1 text-brand-charcoal/70 hover:bg-black/5 hover:text-brand-charcoal"
          >
            <Italic className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        id={id}
        ref={inputRef}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
      />
      {value && (
        <p className="text-xs text-brand-charcoal/50">
          Preview: <InlineMarkdown text={value} />
        </p>
      )}
    </div>
  );
}
