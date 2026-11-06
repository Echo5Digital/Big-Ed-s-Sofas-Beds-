import { siteConfig } from "@/lib/mock-data/site-config";

// Phone number moved off this top strip into FloatingContactButtons (a fixed
// Call + WhatsApp pair at the bottom of the viewport, mounted in
// app/layout.js) — it stays reachable on every page without needing the
// shopper to scroll back to the top. The footer (SiteFooter.jsx) still lists
// the number too, as standard contact info.
export default function AnnouncementBar() {
  return (
    <div className="bg-brand-red-dark text-white">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-center px-4 py-1.5 text-xs sm:px-6 lg:px-10">
        <p className="font-semibold text-brand-gold">{siteConfig.tagline}</p>
      </div>
    </div>
  );
}
