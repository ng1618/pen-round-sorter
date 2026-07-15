import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import NavBar from "@/components/NavBar";
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
  title: "Round Sorter",
  description: "Rank pen-and-paper rounds and get sorted into one.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavBar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
