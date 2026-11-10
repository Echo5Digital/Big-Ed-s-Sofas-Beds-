import { Montserrat } from "next/font/google";

// Heavy italic geometric face used by the homepage "Featured Doorbuster Deals"
// section and the /grand-opening-sale page. Defined once here (next/font wants
// a single module-scope call per font) and imported by both, so it is only
// requested by pages that use it — not by every route via the root layout.
export const montserrat = Montserrat({ subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
