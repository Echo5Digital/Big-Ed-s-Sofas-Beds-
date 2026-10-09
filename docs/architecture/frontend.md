# Frontend Architecture

This document describes the current frontend-only implementation of the Big Ed's
Sofas & Beds homepage and how it is expected to integrate with the future
backend platform.

## Stack

- **Framework:** Next.js 16 (App Router), JavaScript only — no TypeScript.
- **UI:** React 19, function components, `.jsx` files.
- **Styling:** Tailwind CSS v4 (CSS-based config via `@theme` in
  [app/globals.css](../../app/globals.css) — this Tailwind version does not use
  `tailwind.config.js`).
- **Icons:** lucide-react.
- **Fonts:** Google Fonts via `next/font` — Fredoka (display/headlines), Inter
  (body/UI text), Caveat (the handwritten hero accent).
- **Images:** `next/image`, configured in [next.config.mjs](../../next.config.mjs)
  to allow the `images.unsplash.com` remote pattern for placeholder photography.

## Component organization

```
app/
  layout.js        Root layout: fonts, DemoCartProvider, AnnouncementBar, SiteHeader, SiteFooter
  page.jsx          Homepage section composition
  globals.css       Design tokens (colors, fonts) via Tailwind v4 @theme

components/
  layout/           Site chrome: AnnouncementBar, SiteHeader, MobileNavigation,
                     SearchBox, SiteFooter, DemoCartProvider (client context)
  home/             Homepage sections: HeroBanner, CategoryGrid/CategoryCard,
                     FeaturedProducts/ProductCard, DealsBanner, BenefitsSection,
                     ShowroomSection, TestimonialsSection, FinancingBanner,
                     NewsletterSignup
  ui/               Reusable primitives: Button, Container, SectionHeading,
                     StarRating, Price, BearMascot

lib/mock-data/      Centralized demo data (see below)
utils/              formatCurrency.js
```

Server components are used by default throughout; `"use client"` is applied
only where interaction requires it (header state, search, cart/wishlist demo
state, product card add-to-cart, newsletter form, mobile nav).

## Mock data

All demonstration content lives under `lib/mock-data/`:

- `products.js` — product records (`id`, `slug`, `sku`, `category`, `price`,
  `compareAtPrice`, `image`, `badge`, `rating`, `reviewCount`).
- `categories.js` — category records (`id`, `name`, `slug`, `image`).
- `testimonials.js` — testimonial records (`id`, `customerName`, `avatar`,
  `rating`, `quote`).
- `site-config.js` — nav links, footer links, store hours/address/phone,
  benefits list, financing provider placeholders.

**These files are explicitly marked as demo-only in code comments.** Prices,
ratings, review counts, testimonials, store address/hours, and financing
provider names are placeholders and must be replaced with verified data before
production use.

No component hardcodes product or category data directly — everything reads
from these files, so swapping the import for a real data-fetching call later
does not require touching component markup.

## Asset strategy

- **Product/category/showroom photography:** sourced from Unsplash
  (`images.unsplash.com`) as licensed placeholder imagery. Each category and
  product uses a distinct, relevant photo (no single image reused across
  unrelated slots).
- **Logo:** the approved lockup (`public/images/brand/big-eds-logo.webp` — bear
  mascot + "Big Ed's SOFAS & BEDS" wordmark + tagline, baked into one image) is
  used directly via `next/image` in `SiteHeader` and `SiteFooter`. Its path and
  intrinsic dimensions are centralized in `siteConfig.logo`
  (`lib/mock-data/site-config.js`) — update that one object if the logo file
  changes.
- **Big Ed mascot (standalone poses):** `components/ui/BearMascot.jsx` is an
  original placeholder SVG illustration (a bear in blue overalls), used only
  where a standalone mascot pose is needed without the full logo's text
  (hero banner, deals banner, financing banner). It is clearly commented as a
  stand-in — replace its internal `<svg>` with official standalone mascot
  artwork if/when the client supplies one; the component's props (`className`,
  `pose`) are already wired into every call site so no call sites need to
  change.

## Demo-only interactions (explicitly not production behavior)

- **Cart / wishlist:** `components/layout/DemoCartProvider.jsx` is client-side
  React state only (no persistence, no backend call). It exists to demonstrate
  the add-to-cart / wishlist-toggle interaction pattern.
- **Search:** `components/layout/SearchBox.jsx` filters the local
  `lib/mock-data/products.js` array client-side. It does not call an API.
- **Newsletter signup:** `components/home/NewsletterSignup.jsx` validates email
  format client-side and shows an honest "demo only, integration coming soon"
  message — it never claims the email was actually saved anywhere.

None of the above should be mistaken for real commerce functionality. There is
no checkout, no payment processing, no persisted cart, and no real account
system in this phase.

## Planned backend integration (not implemented yet)

The future platform (out of scope for this phase) is expected to be:

- **API:** Node.js + Express.js REST API, modular service/route structure,
  request validation with Zod.
- **Database:** PostgreSQL via Prisma ORM, with relational models and
  constraints, managed through Prisma migrations.

Integration points this frontend is already shaped for:

- `lib/mock-data/products.js` / `categories.js` → replace with a data-fetching
  module (e.g. `lib/api/products.js`) that calls the Express product service.
  Components already consume plain arrays of plain objects, so the shape is
  preserved; only the import source changes.
- `DemoCartProvider` → replace client-only state with calls to a future
  cart/order service once checkout exists; the `useDemoCart()` hook interface
  (`cartCount`, `addToCart`, `wishlistIds`, `toggleWishlist`) can remain the
  same shape so consuming components don't need to change.
- `NewsletterSignup` → replace the local validation-only submit handler with a
  real POST to a future email/notification service.
- `SearchBox` → replace the local `.filter()` over mock data with a real
  search endpoint call once one exists; the component already isolates this
  logic in one `useMemo`.
- Product images are currently static URLs in mock data; once staff-managed
  image upload exists (object storage + CDN), the `image` field becomes a
  CDN URL instead of an Unsplash URL — no component changes required.

## What still needs client-approved/verified content before production

- Official Big Ed mascot and logo artwork (replacing `BearMascot.jsx`).
- Real product names, SKUs, prices, inventory, and photography.
- Verified business address, phone number, and hours
  (`lib/mock-data/site-config.js`).
- Confirmed financing partners — real provider logos (Synchrony, Affirm,
  Klarna, Acima) are displayed in `components/home/FinancingBanner.jsx`
  (`public/images/financing/`), but displaying a logo does not by itself
  confirm an active partnership. Verify each partnership with Big Ed's (or
  remove the corresponding logo) before production.
- Real customer testimonials with consent (current ones are illustrative).
- Real social media profile URLs.
