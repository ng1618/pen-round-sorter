import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { listEntries, listRounds, neuesteZuordnungen } from "@/lib/db/queries";
import { kennzahlen, levelVon, protokollText, type Auslosung } from "@/lib/protokoll";
import type { Level } from "@/lib/types";

/**
 * Den festgelegten Stand zum Bearbeiten holen. Was daraus wird, ist ein NEUER
 * Lauf — der bestehende bleibt unangetastet.
 *
 * Wichtig: der Schnappschuss wird **frisch** aus dem aktuellen Stand gebaut und
 * nicht aus dem alten Lauf uebernommen. Ein neuer Lauf beschreibt die Lage zu
 * seiner Zeit; uebernommen werden nur die Zuordnungen als Ausgangspunkt.
 *
 * Am 02.08. beim Testen aufgefallen: mit dem alten Schnappschuss war eine
 * Platzerhoehung wirkungslos — die Pruefung sah weiterhin die alte Platzzahl und
 * lehnte das Umsetzen als Ueberbelegung ab. Also genau der Ablauf, fuer den die
 * Platzerhoehung ueberhaupt gebaut wurde.
 *
 * Zwei Nebeneffekte, beide erwuenscht: wer seit dem Lauf dazugekommen ist,
 * taucht als "ohne Platz" auf und kann gesetzt werden; wer entfernt wurde,
 * verschwindet.
 */
export async function GET() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const vorher = neuesteZuordnungen();
  if (!vorher) {
    return NextResponse.json({ fehler: "📜 Es ist noch nichts eingetragen — erst auslosen und festlegen." }, { status: 404 });
  }

  const runden = listRounds();
  const spieler = listEntries();
  const rundenIds = new Set(runden.map((r) => r.id));
  const bisher = new Map(vorher.map((z) => [z.playerId, z.roundId]));

  const zuordnungen = spieler.map((person) => {
    const alteRunde = bisher.get(person.id);
    // Eine Runde, die es nicht mehr gibt, zaehlt als "ohne Platz".
    const roundId = alteRunde != null && rundenIds.has(alteRunde) ? alteRunde : null;
    return {
      playerId: person.id,
      roundId,
      receivedLevel: roundId == null ? null : (levelVon(person, roundId) as Level),
    };
  });

  const auslosung: Auslosung = {
    seed: "",
    konfiguration: { verfahren: "rsd", grundlage: "letzter Lauf" },
    eingabestand: { runden, spieler },
    // Die bisherige Reihenfolge, gefiltert; wer neu ist, kommt hinten dran.
    losreihenfolge: [
      ...vorher.map((z) => z.playerId).filter((id) => spieler.some((p) => p.id === id)),
      ...spieler.filter((p) => !bisher.has(p.id)).map((p) => p.id),
    ],
    zuordnungen,
  };

  return NextResponse.json({
    auslosung,
    kennzahlen: kennzahlen(auslosung),
    protokoll: protokollText(auslosung),
  });
}
