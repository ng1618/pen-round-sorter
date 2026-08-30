import { levelVon, type Auslosung } from "./protokoll.ts";

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
