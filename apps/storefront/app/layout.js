import { Fredoka, Inter, Caveat, Luckiest_Guy } from "next/font/google";
import "./globals.css";
import { DemoCartProvider } from "@/components/layout/DemoCartProvider";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

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

export const metadata = {
  title: "Big Ed's Sofas & Beds | Big Comfort. Bigger Savings.",
  description:
    "Quality sofas, sectionals, beds, mattresses, recliners and dining sets at affordable prices. Visit Big Ed's Sofas & Beds showroom today.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${inter.variable} ${caveat.variable} ${luckiestGuy.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-brand-cream text-brand-charcoal">
        <DemoCartProvider>
          <AnnouncementBar />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </DemoCartProvider>
      </body>
    </html>
  );
}
