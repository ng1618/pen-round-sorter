import type { Metadata } from "next";
// Schriften als npm-Pakete statt next/font/google (20.11.): der Railway-Build
// brach in der Google-Schriften-Pipeline von Turbopack ab ("next/font/google
// queries have exactly one entry"), lokal lief er durch. So liegen die
// Dateien im Projekt, und beim Bauen wird nichts aus dem Netz geholt.
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

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
      className="h-full antialiased"
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
