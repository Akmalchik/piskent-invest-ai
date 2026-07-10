import type { Metadata, Viewport } from "next";
import "./globals.css";
// Подключаем стандартные стили для правильного отображения карты Leaflet
import 'leaflet/dist/leaflet.css';

const title = "Piskent Invest — инвестиционный портал Пискентского района";
const description = "Интерактивная карта инвестиционных объектов, цифровой консультант и инвестиционный паспорт Пискентского района.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "Piskent Invest",
    "Пискент",
    "инвестиции",
    "инвестиционные объекты",
    "Toshkent viloyati",
    "Piskent tumani",
    "investment map",
    "Uzbekistan investment",
  ],
  authors: [{ name: "Piskent tumani hokimligi" }],
  creator: "Piskent Invest",
  publisher: "Piskent tumani hokimligi",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title,
    description,
    siteName: "Piskent Invest",
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
