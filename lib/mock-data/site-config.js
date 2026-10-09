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
  // NOTE: all hrefs below are temporarily set to "#" as placeholders until
  // real destination routes/pages exist. Labels and ordering reflect the
  // intended final navigation structure.
  nav: [
    { label: "Living Room", href: "#" },
    { label: "Bedroom", href: "#" },
    { label: "Mattresses", href: "#" },
    { label: "Dining", href: "#" },
    { label: "Deals", href: "#" },
    { label: "Financing", href: "#" },
    { label: "About", href: "#" },
    { label: "Contact", href: "#" },
  ],
  footerQuickLinks: [
    { label: "Living Room", href: "#" },
    { label: "Bedroom", href: "#" },
    { label: "Mattresses", href: "#" },
    { label: "Dining", href: "#" },
    { label: "Deals", href: "#" },
  ],
  footerCompanyLinks: [
    { label: "Financing", href: "#" },
    { label: "About Us", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "#" },
  ],
  footerLegalLinks: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Shipping & Delivery", href: "#" },
    { label: "Returns", href: "#" },
    { label: "Site Map", href: "#" },
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

// Financing providers shown here are generic placeholders for layout purposes only.
// Big Ed's has not confirmed active partnerships with any of these providers.
export const financingProviders = ["Provider A", "Provider B", "Provider C", "Provider D"];
