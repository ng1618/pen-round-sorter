import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { einstellungen, listEntries, listRounds } from "@/lib/db/queries";
import { runLeximin } from "@/lib/leximin";
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

  const regeln = einstellungen();

  // Beide Verfahren liefern die Zuordnungen in der Reihenfolge, in der sie die
  // Personen abgearbeitet haben — daraus wird `losreihenfolge` abgeleitet,
  // statt sie ein zweites Mal zu wuerfeln.
  //
  // Was diese Reihenfolge **bedeutet**, ist bei den beiden aber verschieden,
  // und deshalb traegt die Konfiguration es mit: bei RSD ist sie die Ziehung
  // selbst, bei Leximin nur der Gleichstandsentscheid — gezogen wird dort
  // nichts, gerechnet schon.
  const leximin = regeln.verfahren === "leximin";
  const zuordnungen = leximin ? runLeximin(runden, spieler) : runMatching(runden, spieler);

  const auslosung: Auslosung = {
    seed: "",
    // Die geltenden Einstellungen wandern in den Lauf. Ohne das behauptete ein
    // alter Lauf spaeter Regeln, die inzwischen umgestellt wurden.
    konfiguration: {
      ...regeln,
      reihenfolge: leximin ? "gleichstand" : reihenfolgeRegel(runden, spieler),
    },
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
