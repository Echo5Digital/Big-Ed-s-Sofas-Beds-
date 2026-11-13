// Centralized placeholder business data for the Big Ed's Sofas & Beds demo frontend.
// NOTE: All contact details, hours, and social links below are placeholders and must
// be replaced with client-approved, verified business information before production.

export const siteConfig = {
  brandName: "Big Ed's",
  brandSubtitle: "Sofas & Beds",
  tagline: "Big Comfort. Bigger Savings.",
  logo: {
    src: "/images/brand/big-eds-logo.webp",
    width: 1921,
    height: 817,
    alt: "Big Ed's Sofas & Beds — Quality Furniture, Comfort for Life",
  },
  phone: "(863) 555-0123",
  phoneHref: "tel:+18635550123",
  // Same placeholder number as phone/phoneHref above — no separate WhatsApp
  // Business number has been supplied yet. wa.me requires digits only (no
  // "+", spaces, or punctuation).
  whatsappHref: "https://wa.me/18635550123",
  hours: [
    { days: "Mon – Sat", time: "9AM – 7PM" },
    { days: "Sunday", time: "11AM – 5PM" },
  ],
  address: {
    line1: "17535 Tomball Pkwy",
    line2: "Houston, TX 77064",
  },
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=17535+Tomball+Pkwy+Houston+TX+77064",
  // No Google Maps API key required: this is the public "search, output as
  // embed" URL format (maps.google.com/maps?q=...&output=embed), distinct
  // from the API-keyed /maps/embed/v1/ endpoint.
  mapsEmbedUrl: "https://maps.google.com/maps?q=17535+Tomball+Pkwy+Houston+TX+77064&output=embed",
  social: {
    facebook: "#",
    instagram: "#",
    youtube: "#",
    tiktok: "#",
  },
  // Header nav and footer "Quick Links" (both category-based) are built live
  // from the real Category table — see lib/categoryTree.js's buildNavItems
  // and buildFooterCategoryLinks, consumed by SiteHeader/MobileNavigation
  // and SiteFooter respectively — so a category created via the admin's
  // "Add new category" shows up with no edit here. Only non-category nav
  // entries stay static (merged in by buildNavItems at the same positions
  // the old hand-authored list had them: About first, Deals last).
  footerCompanyLinks: [
    { label: "Financing", href: "/financing" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Careers", href: "/careers" },
    { label: "Blog", href: "/blog" },
  ],
  footerLegalLinks: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Shipping & Delivery", href: "/shipping-delivery" },
    { label: "Returns", href: "/returns" },
  ],
};

export const benefits = [
  {
    id: "showroom",
    title: "Local Showroom",
    description: "See it. Sit on it.\nLove it.",
    icon: "map-pin",
  },
  {
    id: "delivery",
    title: "Fast Delivery",
    description: "Get your furniture\nsooner.",
    icon: "truck",
  },
  {
    id: "financing",
    title: "Flexible Financing",
    description: "Comfort today.\nPay your way.",
    icon: "credit-card",
  },
  {
    id: "quality",
    title: "Quality Furniture",
    description: "Trusted brands.\nBuilt to last.",
    icon: "gem",
  },
  {
    id: "prices",
    title: "Great Prices",
    description: "Big selection.\nBigger savings.",
    icon: "tag",
  },
];

// Financing provider logos supplied for this build. Displaying a provider's logo
// here does NOT by itself confirm an active financing partnership — verify each
// partnership with Big Ed's before this goes live in production.
export const financingProviders = [
  { id: "synchrony", name: "Synchrony Financial", logo: "/images/financing/synchrony.jpg" },
  { id: "affirm", name: "Affirm", logo: "/images/financing/affirm.png" },
  { id: "klarna", name: "Klarna", logo: "/images/financing/klarna.webp" },
  { id: "acima", name: "Acima", logo: "/images/financing/acima.png" },
];
