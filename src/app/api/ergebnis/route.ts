import { NextResponse } from "next/server";
import { gastZugelassen } from "@/lib/auth";
import { neuesterLaufVoll } from "@/lib/db/queries";

/**
 * Das festgelegte Ergebnis fuer Gaeste (20.11.): je Tisch Titel, Leitung und
 * Namen — **keine** Stufe. Wie gern jemand an seinen Tisch wollte, ist ein
 * Stueck seines Rankings und geht die anderen nichts an.
 *
 * Aus dem Schnappschuss des festgelegten Laufs, damit Namen und Tische zu dem
 * passen, was festgelegt wurde. Hinter dem Gast-Passwort wie `/rank`.
 */
export async function GET() {
  if (!(await gastZugelassen())) {
    return NextResponse.json({ fehler: "Bitte zuerst das Gast-Passwort eingeben.", gastPasswort: true }, { status: 401 });
  }

  const lauf = neuesterLaufVoll();
  if (!lauf) return NextResponse.json({ festgelegt: false });

  const name = new Map(lauf.eingabestand.spieler.map((s) => [s.id, s.playerName]));
  const tische = lauf.eingabestand.runden.map((r) => ({
    titel: r.title,
    leitung: r.dmName,
    namen: lauf.zuordnungen
      .filter((z) => z.roundId === r.id)
      .map((z) => name.get(z.playerId) ?? "?")
      .sort((a, b) => a.localeCompare(b, "de")),
  }));
  const ohnePlatz = lauf.zuordnungen
    .filter((z) => z.roundId == null)
    .map((z) => name.get(z.playerId) ?? "?")
    .sort((a, b) => a.localeCompare(b, "de"));

  return NextResponse.json({ festgelegt: true, tische, ohnePlatz });
}
