import type { Metadata, Viewport } from "next";
import "./globals.css";
// Подключаем стандартные стили для правильного отображения карты Leaflet
import 'leaflet/dist/leaflet.css';

const siteUrl = "https://www.piskentinvest.uz";
const title = "Piskent Invest AI — Piskent tumani investitsiya portali";
const description = "Piskent tumanidagi investitsiya obyektlari, yer maydonlari, binolar va infratuzilma imkoniyatlarini xarita va sun’iy intellekt yordamida ko‘rsatib beruvchi raqamli portal.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "Piskent Invest AI",
    "Piskent invest",
    "Piskent investitsiya",
    "Piskent tumani",
    "investitsiya obyektlari",
    "yer maydoni",
    "investitsiya xaritasi",
    "Пискент инвест",
    "Пискент инвестиция",
  ],
  authors: [{ name: "Piskent tumani hokimligi" }],
  creator: "Piskent Invest",
  publisher: "Piskent tumani hokimligi",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Piskent Invest AI",
    locale: "uz_UZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const systemFontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <html
      lang="uz"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: systemFontFamily }}>{children}</body>
    </html>
  );
}
