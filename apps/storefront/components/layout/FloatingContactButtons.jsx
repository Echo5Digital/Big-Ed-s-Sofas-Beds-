import { Phone } from "lucide-react";
import { siteConfig } from "@/lib/mock-data/site-config";

// WhatsApp has no icon in lucide-react (a generic/non-brand icon set) — this
// is the widely-used generic speech-bubble-and-phone glyph for the WhatsApp
// brand, not a copy of any proprietary asset file.
function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.95L2 22l5.2-1.36A9.96 9.96 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.2a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.09.81.83-3.01-.2-.31a8.19 8.19 0 1 1 6.94 3.83Zm4.49-6.13c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.17.25-.64.8-.78.96-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.37 1 2.54c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.08.14-1.18-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}

// Fixed Call + WhatsApp buttons, always reachable regardless of scroll
// position — replaces the plain phone number/link that used to live in the
// top AnnouncementBar strip (now gone from there entirely, see that
// component). Mounted once in app/layout.js so it appears on every page.
//
// bottom-20 on mobile (sm:bottom-4 above that breakpoint) clears the product
// detail page's own fixed sticky "Add to Cart" bar (ProductPurchasePanel.jsx,
// also bottom-0 and also only shown below sm) so the two don't overlap —
// that bar is roughly 64px tall there (see its own h-16 spacer), so these
// buttons sit above it with a small gap instead of underneath/behind it.
export default function FloatingContactButtons() {
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-end gap-3 px-4 sm:bottom-4 sm:px-6 lg:px-10">
      <a
        href={siteConfig.phoneHref}
        aria-label={`Call us at ${siteConfig.phone}`}
        className="flex size-12 items-center justify-center rounded-full bg-brand-red text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark sm:size-14"
      >
        <Phone className="size-5 sm:size-6" aria-hidden="true" />
      </a>
      <a
        href={siteConfig.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#1ebe5a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5a] sm:size-14"
      >
        <WhatsAppIcon className="size-6 sm:size-7" />
      </a>
    </div>
  );
}
