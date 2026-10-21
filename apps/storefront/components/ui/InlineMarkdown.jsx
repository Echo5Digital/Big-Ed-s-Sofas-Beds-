import { parseInlineMarkdown } from "@big-eds/ui";

// Renders the **bold** / _italic_ subset an admin can apply to a product name
// via the admin form's formatting toolbar. Never dangerouslySetInnerHTML —
// parseInlineMarkdown returns plain-data segments, not markup.
export default function InlineMarkdown({ text, className }) {
  const segments = parseInlineMarkdown(text);
  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.bold) return <strong key={i}>{seg.text}</strong>;
        if (seg.italic) return <em key={i}>{seg.text}</em>;
        return <span key={i}>{seg.text}</span>;
      })}
    </span>
  );
}
