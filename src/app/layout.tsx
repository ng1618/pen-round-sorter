import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Rundenverteiler",
  description: "Wünsche abgeben und an einen Tisch kommen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${cinzel.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      {/* Navigationsleiste und <main> kommen aus den Gruppen-Layouts:
          (mit-nav) fuer Start und Verwaltung, (ohne-nav) fuer /dm und /rank. */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
