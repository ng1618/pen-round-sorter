import Link from "next/link";

/** „Start" steht vorne, wo vorher der Schriftzug stand — deshalb nicht in dieser Liste. */
const links = [
  { href: "/dm", label: "Runde eintragen" },
  { href: "/rank", label: "Wünsche abgeben" },
  { href: "/admin", label: "Verwaltung" },
];

export default function NavBar() {
  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
        <Link href="/" className="font-heading font-semibold text-accent hover:opacity-80">
          📜 Start
        </Link>
        <div className="flex gap-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
