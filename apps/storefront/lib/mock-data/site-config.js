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
  hours: [
    { days: "Mon – Sat", time: "9AM – 7PM" },
    { days: "Sunday", time: "11AM – 5PM" },
  ],
  address: {
    line1: "17535 US Highway 27",
    line2: "Lake Wales, FL 33853",
  },
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
        { label: "Stationary Sofa & Loveseats", href: "/shop/stationary-sofas-loveseats" },
        { label: "Stationary Sectionals", href: "/shop/stationary-sectionals" },
        { label: "Reclining Sofa & Loveseats", href: "/shop/reclining-sofas-loveseats" },
        { label: "Reclining Sectionals", href: "/shop/reclining-sectionals" },
        { label: "Recliners & Lift Chairs", href: "/shop/recliners-lift-chairs" },
        { label: "Sleepers & Futons", href: "/shop/sleepers-futons" },
        { label: "Occasional Tables", href: "/shop/occasional-tables" },
        { label: "TV Stands", href: "/shop/tv-stands" },
      ],
    },
    {
      label: "Bedroom",
      href: "/shop/bedroom",
      children: [
        { label: "Beds", href: "/shop/beds" },
        { label: "Bedroom Furniture", href: "/shop/bedroom-furniture" },
        { label: "Mattresses", href: "/shop/mattresses" },
        { label: "Daybeds", href: "/shop/daybeds" },
        { label: "Bunk Beds", href: "/shop/bunk-beds" },
        { label: "Vanities & Mirrors", href: "/shop/vanities-mirrors" },
      ],
    },
    {
      label: "Dining",
      href: "/shop/dining",
      children: [
        { label: "Dining Room Furniture", href: "/shop/dining-room-furniture" },
        { label: "Barstools", href: "/shop/barstools" },
      ],
    },
    {
      label: "Office",
      href: "/shop/office",
      children: [{ label: "Office & Bookcase", href: "/shop/office-bookcase" }],
    },
    {
      label: "Accessories",
      href: "/shop/accessories",
      children: [{ label: "Home Accessories", href: "/shop/home-accessories" }],
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
    { label: "Site Map", href: "/sitemap" },
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
