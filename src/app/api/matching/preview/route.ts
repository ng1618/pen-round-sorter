import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { listEntries, listRounds } from "@/lib/db/queries";
import { reihenfolgeRegel, runMatching } from "@/lib/matching";
import { kennzahlen, protokollText, type Auslosung } from "@/lib/protokoll";

/**
 * Auslosen ohne zu schreiben.
 *
 * Der `eingabestand` entsteht **hier**, nicht beim Festlegen. Reicht jemand in
 * den Sekunden dazwischen ein, gehoerte sonst ein Schnappschuss zur Zeile, der
 * nicht zu dem Ergebnis passt, das auf dem Schirm stand.
 */
export async function POST() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const runden = listRounds();
  const spieler = listEntries();

  if (runden.length === 0 || spieler.length === 0) {
    return NextResponse.json({ fehler: "🎲 Ohne Tische oder ohne Gäste lässt sich nichts auslosen." }, { status: 400 });
  }

  // `runMatching` liefert die Zuordnungen in der Losreihenfolge — daraus wird
  // sie abgeleitet, statt sie ein zweites Mal zu wuerfeln.
  const zuordnungen = runMatching(runden, spieler);

  const auslosung: Auslosung = {
    seed: "",
    konfiguration: { verfahren: "rsd", reihenfolge: reihenfolgeRegel(runden, spieler) },
    eingabestand: { runden, spieler },
    losreihenfolge: zuordnungen.map((z) => z.playerId),
    zuordnungen,
  };

  return NextResponse.json({
    auslosung,
    kennzahlen: kennzahlen(auslosung),
    protokoll: protokollText(auslosung),
  });
}
