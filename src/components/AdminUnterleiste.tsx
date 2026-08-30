"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Reiter innerhalb der Verwaltung.
 *
 * Seit dem 30.08. die einzige Navigation der App. Die obere Leiste ist
 * entfallen: Leitungen und Spielende kommen ueber ihren QR-Code direkt auf
 * `/dm` bzw. `/rank` und brauchen keine Wegweiser — die Verwaltung dagegen
 * schon, seit sie auf drei Seiten liegt.
 */
const REITER = [
  { href: "/admin", label: "Tresen" },
  { href: "/admin/auslosen", label: "Auslosung" },
  { href: "/admin/einstellungen", label: "Einstellungen" },
];

export default function AdminUnterleiste() {
  const pfad = usePathname();

  async function abmelden() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/";
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <nav className="flex gap-1 text-sm">
        {REITER.map((r) => {
          const aktiv = pfad === r.href;
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={aktiv ? "page" : undefined}
              className={
                aktiv
                  ? "rounded-md bg-card px-3 py-1.5 font-medium text-accent"
                  : "rounded-md px-3 py-1.5 text-muted hover:text-foreground"
              }
            >
              {r.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={abmelden} className="text-sm text-muted hover:text-foreground">
        Abmelden
      </button>
    </div>
  );
}
