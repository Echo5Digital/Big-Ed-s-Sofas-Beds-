import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Big Ed OS — Retail Operations",
  description: "Staff dashboard for catalog, inventory, and purchasing at Big Ed's Sofas & Beds.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${inter.variable} h-full`}>
      <body className="h-full font-sans antialiased" style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
