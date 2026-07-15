import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/dm", label: "Submit a round" },
  { href: "/rank", label: "Rank rounds" },
  { href: "/admin", label: "Admin" },
];

export default function NavBar() {
  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
        <span className="font-heading font-semibold text-accent">📜 Round Sorter</span>
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
