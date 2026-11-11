import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

// Same heading typeface as apps/storefront (see its app/layout.js) so staff
// and customer-facing headings read as one system.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Big Ed OS — Retail Operations",
  description: "Staff dashboard for catalog, inventory, and purchasing at Big Ed's Sofas & Beds.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/Big_ed_favicon.webp",
    shortcut: "/Big_ed_favicon.webp",
    apple: "/Big_ed_favicon.webp",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${lora.variable} ${inter.variable} h-full`}>
      <body className="h-full font-sans antialiased" style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
