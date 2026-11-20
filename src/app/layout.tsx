import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Schrift "klar" (20.11.): Space Grotesk fuer Ueberschriften, Inter fuer Text.
const ueberschrift = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const text = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${ueberschrift.variable} ${text.variable} h-full antialiased`}
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
