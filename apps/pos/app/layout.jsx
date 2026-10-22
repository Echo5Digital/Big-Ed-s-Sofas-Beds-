import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { RegisterSessionProvider } from "@/lib/hooks/useRegisterSession";

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
  title: "Big Ed POS — Cashier",
  description: "In-store checkout for Big Ed's Sofas & Beds.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/Big_ed_favicon.webp",
    shortcut: "/Big_ed_favicon.webp",
    apple: "/Big_ed_favicon.webp",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${inter.variable} h-full`}>
      <body className="h-full font-sans antialiased" style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui" }}>
        <AuthProvider>
          <RegisterSessionProvider>{children}</RegisterSessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
