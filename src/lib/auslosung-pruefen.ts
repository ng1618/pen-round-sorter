import { nameKey } from "./einreichung.ts";
import { levelVon, type Auslosung } from "./protokoll.ts";
import type { PlayerEntry, Round } from "./types.ts";

export type StandAbgleich =
  | { art: "gleich" }
  /** Seit dem Auslosen dazugekommen — festlegen geht, die Neuen bleiben ohne Platz. */
  | { art: "dazu"; namen: string[]; runden: number }
  /** Jemand oder etwas aus der Auslosung gibt es so nicht mehr — nur neu auslosen hilft. */
  | { art: "fehlt"; namen: string[] };

/**
 * Passt der Schnappschuss einer Auslosung noch zum Live-Stand?
 *
 * Verglichen wird **wer**, nicht **wie viele**. Bis zum 15.11. zaehlte `commit`
 * nur — und das reichte nicht: SQLite vergibt die Id einer geloeschten Zeile
 * neu (`INTEGER PRIMARY KEY` ohne `AUTOINCREMENT`). Wer nach dem Auslosen die
 * zuletzt eingereichte Person entfernte und dann jemanden Neues einreichen
 * liess, bekam einen Lauf, dessen Schnappschuss die alte Person nannte und
 * dessen Zuordnung die neue — die nie mitgelost wurde. War die Id nicht die
 * letzte, schlug der Fremdschluessel zu, und Festlegen endete in einem 500.
 *
 * Gleiche Id gilt deshalb nur mit gleichem `nameKey` als dieselbe Person.
 * „Sarah" → „SARAH " ist dieselbe (der Upsert darf den Namen so ersetzen).
 */
export function standAbgleich(
  eingabestand: { runden: Round[]; spieler: PlayerEntry[] },
  runden: Round[],
  spieler: PlayerEntry[],
): StandAbgleich {
  const jetztSpieler = new Map(spieler.map((s) => [s.id, nameKey(s.playerName)]));
  const jetztRunden = new Set(runden.map((r) => r.id));

  const fehlend = eingabestand.spieler
    .filter((s) => jetztSpieler.get(s.id) !== nameKey(s.playerName))
    .map((s) => s.playerName);
  const rundenFehlen = eingabestand.runden.filter((r) => !jetztRunden.has(r.id)).map((r) => r.title);
  if (fehlend.length > 0 || rundenFehlen.length > 0) {
    return { art: "fehlt", namen: [...fehlend, ...rundenFehlen] };
  }

  const vorher = new Set(eingabestand.spieler.map((s) => s.id));
  const vorherRunden = new Set(eingabestand.runden.map((r) => r.id));
  const neu = spieler.filter((s) => !vorher.has(s.id)).map((s) => s.playerName);
  const neueRunden = runden.filter((r) => !vorherRunden.has(r.id)).length;
  if (neu.length > 0 || neueRunden > 0) return { art: "dazu", namen: neu, runden: neueRunden };
  return { art: "gleich" };
}

/**
 * Prüft eine Auslosung gegen **ihren eigenen Schnappschuss**, nicht gegen den
 * Live-Stand — was gespeichert wird, muss in sich stimmig sein.
 *
 * Diese Funktion ist seit dem 30.08. die **einzige** Schranke gegen
 * Überbelegung. Vorher lehnte auch die Oberfläche jedes Umsetzen in einen
 * vollen Tisch ab; das musste weichen, weil damit bei 15 Personen auf 15
 * Plätzen — der geplanten Aufstellung — jede Handkorrektur unmöglich war. Jetzt
 * darf man umsetzen, die Überbelegung wird angezeigt, und **festlegen** geht
 * erst wieder, wenn sie aufgelöst ist. Der Riegel sitzt damit dort, wo etwas
 * Bleibendes entsteht.
 *
 * Deshalb steht sie hier als reine Funktion und nicht mehr in der Route: eine
 * Schranke, auf die alles andere sich verlässt, gehört geprüft.
 *
 * @returns Fehlertext, oder `null` wenn alles stimmt.
 */
export function pruefeAuslosung(a: Auslosung | undefined): string | null {
  if (!a?.eingabestand?.runden || !a.eingabestand.spieler || !Array.isArray(a.zuordnungen)) {
    return "Auslosung unvollstaendig.";
  }

  const runden = new Map(a.eingabestand.runden.map((r) => [r.id, r]));
  const spieler = new Map(a.eingabestand.spieler.map((s) => [s.id, s]));
  const gesehen = new Set<number>();
  const belegt = new Map<number, number>();

  for (const z of a.zuordnungen) {
    const person = spieler.get(z.playerId);
    if (!person) return `Unbekannte Person ${z.playerId}.`;
    if (gesehen.has(z.playerId)) return `Person ${z.playerId} kommt doppelt vor.`;
    gesehen.add(z.playerId);

    if (z.roundId == null) {
      if (z.receivedLevel != null) return `Person ${z.playerId}: ohne Platz, aber mit Level.`;
      continue;
    }

    const runde = runden.get(z.roundId);
    if (!runde) return `Unbekannte Runde ${z.roundId}.`;

    // Das Level wird nachgerechnet und nicht geglaubt — sonst koennte eine
    // Handkorrektur spaeter in der Statistik besser aussehen als sie war.
    const erwartet = levelVon(person, z.roundId);
    if (z.receivedLevel !== erwartet) {
      return `Person ${z.playerId}: Level ${z.receivedLevel} passt nicht zu ihrer Angabe (${erwartet}).`;
    }

    const n = (belegt.get(z.roundId) ?? 0) + 1;
    belegt.set(z.roundId, n);
    if (n > runde.capacity) return `Runde "${runde.title}" waere mit ${n} von ${runde.capacity} ueberbelegt.`;
  }

  return null;
}
