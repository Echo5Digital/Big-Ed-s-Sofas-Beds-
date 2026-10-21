// Shared brand tokens consumed by both the storefront and admin Tailwind themes.
// Keep this in sync with apps/storefront/app/globals.css @theme block.

const brandColors = {
  cream: "#FBF4E9",
  charcoal: "#262321",
  red: "#C8372C",
  redDark: "#A52B22",
  gold: "#D9A441",
};

// Tokenizes a lightweight inline-markdown subset (**bold**, _italic_) used
// for product names, into plain-data segments — never raw HTML, so there is
// no injection surface. Callers in each app map segments to their own
// <strong>/<em> elements; this package stays JSX-free so it works in both
// the admin and storefront React trees without a build-time JSX dependency.
// Supported: **bold**, _italic_. Unmatched markers are treated as literal
// text rather than left dangling, so "a ** b" renders as-is.
function parseInlineMarkdown(input) {
  const text = input ?? "";
  const pattern = /\*\*(.+?)\*\*|_(.+?)_/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ text: match[1], bold: true });
    } else {
      segments.push({ text: match[2], italic: true });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ text }];
}

// Strips ** and _ markers for contexts that need the plain name text —
// alt text, aria-label, <title>, cart line items — where literal asterisks/
// underscores would read as a visible bug, not formatting.
function stripInlineMarkdown(input) {
  return parseInlineMarkdown(input)
    .map((seg) => seg.text)
    .join("");
}

module.exports = { brandColors, parseInlineMarkdown, stripInlineMarkdown };
