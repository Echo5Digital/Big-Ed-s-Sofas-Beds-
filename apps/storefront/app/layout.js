import { cacheLife } from "next/cache";
import { Fredoka, Inter, Caveat, Luckiest_Guy, Lora } from "next/font/google";
import "./globals.css";
import { DemoCartProvider } from "@/components/layout/DemoCartProvider";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import FloatingContactButtons from "@/components/layout/FloatingContactButtons";
import { getCategories } from "@/lib/api/catalog";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const luckiestGuy = Luckiest_Guy({
  variable: "--font-luckiest-guy",
  subsets: ["latin"],
  weight: ["400"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata = {
  title: "Big Ed's Sofas & Beds | Big Comfort. Bigger Savings.",
  description:
    "Quality sofas, sectionals, beds, mattresses, recliners and dining sets at affordable prices. Visit Big Ed's Sofas & Beds showroom today.",
  icons: {
    icon: "/Big_ed_favicon.webp",
    shortcut: "/Big_ed_favicon.webp",
    apple: "/Big_ed_favicon.webp",
  },
};

// RootLayout wraps every route, including ones that deliberately stay
// prerenderable (the homepage's own data uses this exact "use cache" +
// cacheLife("minutes") pattern — see getHomepageData in app/page.jsx) — an
// uncached fetch here would force every route in the app into blocking/
// dynamic rendering regardless of that route's own `instant` setting,
// which is the "Next.js encountered uncached data during prerendering"
// error this fixes. A category created via the admin now shows up in the
// nav/footer within a few minutes rather than instantly, the same
// staleness tradeoff the homepage's category-adjacent content already
// accepts — acceptable here since this is nav chrome, not checkout/stock
// data.
async function getLayoutCategories() {
  "use cache";
  cacheLife("minutes");
  return getCategories();
}

export default async function RootLayout({ children }) {
  const categories = await getLayoutCategories();

  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${inter.variable} ${caveat.variable} ${luckiestGuy.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-brand-cream text-brand-charcoal">
        <DemoCartProvider>
          <SiteHeader categories={categories} />
          <main className="flex-1">{children}</main>
          <SiteFooter categories={categories} />
          <FloatingContactButtons />
        </DemoCartProvider>
      </body>
    </html>
  );
}
