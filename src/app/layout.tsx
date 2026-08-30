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
      {/* Ein Layout fuer alle Seiten. Die Route-Gruppen (mit-nav)/(ohne-nav)
          sind am 30.08. entfallen: sie unterschieden sich nur durch die
          Navigationsleiste, und die war funktionslos — Leitungen und Spielende
          kommen ueber ihren QR-Code direkt auf ihre Seite, die Verwaltung hat
          ihre eigene Unterleiste. Ohne die Leiste waren beide Layouts gleich,
          also blieb nur totes Geruest. */}
      <body className="min-h-full flex flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
