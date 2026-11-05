"use client";

import { usePathname } from "next/navigation";
import FinancingBanner from "@/components/home/FinancingBanner";

// Shown on every page except: Home (renders FinancingBanner directly at the
// end of its own curated section flow — see app/page.jsx — so it lands right
// above the footer instead of wherever this generic layout-level placement
// would put it) and /financing (the banner's own destination page — a
// "Learn About Financing" link back to the page already showing it would be
// redundant). Cart/Checkout/Account are also excluded — standard e-commerce
// practice is to keep the purchase flow free of promotional distractions.
const EXCLUDED_PATHS = new Set(["/", "/financing", "/cart", "/checkout", "/account"]);

export default function ConditionalFinancingBanner() {
  const pathname = usePathname();
  if (EXCLUDED_PATHS.has(pathname)) return null;
  return <FinancingBanner />;
}
