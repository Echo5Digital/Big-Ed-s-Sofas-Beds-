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
  // Hrefs point at real Category.slug values seeded in packages/database/prisma/seed.js.
  // Top-level groups with children render as dropdown/mega-menus; items with no
  // children (Deals, About) render as plain links. Financing and Contact are
  // intentionally header-free — they only appear in the footer and on their own pages.
  nav: [
    { label: "About", href: "/about" },
    {
      label: "Living Room",
      href: "/shop/living-room",
      children: [
        { label: "Stationary Sofa & Loveseats", href: "/shop/living-room/stationary-sofas-loveseats" },
        { label: "Stationary Sectionals", href: "/shop/living-room/stationary-sectionals" },
        { label: "Reclining Sofa & Loveseats", href: "/shop/living-room/reclining-sofas-loveseats" },
        { label: "Reclining Sectionals", href: "/shop/living-room/reclining-sectionals" },
        { label: "Recliners & Lift Chairs", href: "/shop/living-room/recliners-lift-chairs" },
        { label: "Sleepers & Futons", href: "/shop/living-room/sleepers-futons" },
        { label: "Occasional Tables", href: "/shop/living-room/occasional-tables" },
        { label: "TV Stands", href: "/shop/living-room/tv-stands" },
      ],
    },
    {
      label: "Bedroom",
      href: "/shop/bedroom",
      children: [
        { label: "Beds", href: "/shop/bedroom/beds" },
        { label: "Bedroom Furniture", href: "/shop/bedroom/bedroom-furniture" },
        { label: "Mattresses", href: "/shop/bedroom/mattresses" },
        { label: "Daybeds", href: "/shop/bedroom/daybeds" },
        { label: "Bunk Beds", href: "/shop/bedroom/bunk-beds" },
        { label: "Vanities & Mirrors", href: "/shop/bedroom/vanities-mirrors" },
      ],
    },
    {
      label: "Dining",
      href: "/shop/dining",
      children: [
        { label: "Dining Room Furniture", href: "/shop/dining/dining-room-furniture" },
        { label: "Barstools", href: "/shop/dining/barstools" },
      ],
    },
    {
      label: "Office",
      href: "/shop/office",
      children: [{ label: "Office & Bookcase", href: "/shop/office/office-bookcase" }],
    },
    {
      label: "Accessories",
      href: "/shop/accessories",
      children: [{ label: "Home Accessories", href: "/shop/accessories/home-accessories" }],
    },
    {
      label: "Deals",
      href: "/deals",
    },
  ],
  footerQuickLinks: [
    { label: "Living Room", href: "/shop/living-room" },
    { label: "Bedroom", href: "/shop/bedroom" },
    { label: "Dining", href: "/shop/dining" },
    { label: "Office", href: "/shop/office" },
    { label: "Accessories", href: "/shop/accessories" },
    { label: "Deals", href: "/deals" },
  ],
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
