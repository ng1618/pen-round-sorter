import { LEVEL_STANDARD, type Assignment, type Level, type PlayerEntry } from "./types.ts";

/**
 * Top Trading Cycles als **Tauschrunde** auf einer bestehenden Sitzordnung.
 *
 * Gesucht sind Ringtäusche: Anneke will an Nils' Tisch, Nils an Ilvas, Ilva an
 * Annekes — alle drei rücken einen weiter, **niemand steht schlechter da und
 * mindestens einer besser**. Solche Ringe sieht man von Hand nicht mehr, sobald
 * mehr als zwei Personen daran hängen.
 *
 * **Warum das kein Auslosungsverfahren ist.** TTC braucht Anfangsbesitz. Ohne
 * den müsste man erst zufällig verteilen und dann tauschen lassen — und diese
 * Konstruktion erzeugt nachweislich dieselbe Verteilung wie RSD
 * (Abdulkadiroğlu & Sönmez, 1998). Als drittes Verfahren wäre es also ein
 * zweiter Name für das, was ohnehin läuft. Als Reparaturschritt auf einer
 * *vorhandenen* Sitzordnung leistet es dagegen etwas, das sonst nichts leistet.
 *
 * **Wann überhaupt etwas zu finden ist.** Eine frische RSD-Auslosung ist bereits
 * verbesserungsfrei — dort findet die Tauschrunde nichts, und das ist kein
 * Fehler, sondern die Bestätigung. Ergiebig wird sie, sobald von Hand geschoben,
 * Nachzügler gesetzt oder Plätze erhöht wurden.
 *
 * **Zwei Eigenschaften, die den Schritt sicher machen:**
 *
 * 1. Die Belegung jeder Runde bleibt **unverändert** — in einem Ring gibt jede
 *    beteiligte Runde genau so oft ab, wie sie aufnimmt. Kapazitäten können also
 *    gar nicht verletzt werden.
 * 2. TTC ist **manipulationsfest**. Der Schritt kostet die Fairnessbegründung
 *    nichts, anders als ein optimierendes Verfahren.
 */

export type Ringtausch = {
  /** In Ringreihenfolge: Person `i` zieht in die Runde von Person `i + 1`. */
  personen: number[];
  /** Die Runden in derselben Reihenfolge — für die Anzeige. */
  runden: number[];
};

export type TauschErgebnis = {
  zuordnungen: Assignment[];
  ringe: Ringtausch[];
};

/**
 * Sucht und vollzieht Ringtäusche, bis keiner mehr übrig ist.
 *
 * Ohne Platz sitzende Personen bleiben außen vor: wer nichts hat, kann nichts
 * eintauschen. Freie Plätze zu füllen ist eine andere Handlung — die macht die
 * Verwaltung von Hand.
 */
export function tauschrunde(spieler: PlayerEntry[], zuordnungen: Assignment[]): TauschErgebnis {
  const personVon = new Map(spieler.map((p) => [p.id, p]));
  const runde = new Map<number, number>();
  for (const z of zuordnungen) {
    if (z.roundId != null && personVon.has(z.playerId)) runde.set(z.playerId, z.roundId);
  }

  const level = (playerId: number, rundenId: number): Level => {
    const person = personVon.get(playerId);
    return ((person?.preferences.find((p) => p.roundId === rundenId)?.level ??
      LEVEL_STANDARD) as Level);
  };

  const sitzende = [...runde.keys()];
  const ringe: Ringtausch[] = [];

  // Jeder Durchlauf vollzieht höchstens einen Ring. Weil jeder Ring mindestens
  // eine echte Verbesserung enthält und niemanden schlechterstellt, wächst die
  // Summe der Level dabei echt — das Verfahren kann also nicht endlos laufen.
  // Die Obergrenze ist nur ein Riegel gegen Denkfehler.
  const OBERGRENZE = sitzende.length * 4 + 8;

  for (let versuch = 0; versuch < OBERGRENZE; versuch++) {
    const ring = ersterRing(sitzende, runde, level);
    if (!ring) break;

    ringe.push({ personen: ring, runden: ring.map((id) => runde.get(id)!) });

    // Erst alle Ziele einsammeln, dann umsetzen — sonst liest der zweite
    // Teilnehmer schon die neue Runde des ersten.
    const ziele = ring.map((_, i) => runde.get(ring[(i + 1) % ring.length])!);
    ring.forEach((id, i) => runde.set(id, ziele[i]));
  }

  return {
    zuordnungen: zuordnungen.map((z) => {
      const neu = runde.get(z.playerId);
      if (neu == null || neu === z.roundId) return z;
      return { playerId: z.playerId, roundId: neu, receivedLevel: level(z.playerId, neu) };
    }),
    ringe,
  };
}

/**
 * Einen Ring finden, bei dem **niemand verliert und mindestens einer gewinnt**.
 *
 * Die naheliegende Fassung — jede Person zeigt nur auf echt bessere Runden —
 * ist zu eng. Am 30.08. in der Anwendung aufgefallen: Nora hatte jede Runde mit
 * 😬 markiert, gewinnt also nie *strikt* und blockierte damit einen Ring, an dem
 * ein anderer sehr wohl gewonnen haette. Sie umzusetzen kostet sie aber nach
 * ihrer eigenen Aussage nichts — dasselbe Argument, aus dem Gleichgueltige
 * zuletzt gezogen werden.
 *
 * Also: Kanten auf **mindestens gleich gut**, und ein Ring zaehlt nur, wenn er
 * mindestens eine echte Verbesserung enthaelt. Umgesetzt wird das ueber die
 * strikten Kanten: fuer jede davon wird geprueft, ob es von ihrem Ziel aus einen
 * Rueckweg gibt, der niemanden schlechterstellt.
 *
 * Damit bleibt die Abbruchgarantie erhalten — jeder vollzogene Ring hebt die
 * Summe der Level echt an, und die ist nach oben begrenzt.
 */
function ersterRing(
  sitzende: number[],
  runde: Map<number, number>,
  level: (playerId: number, rundenId: number) => number,
): number[] | null {
  const eigenes = new Map(sitzende.map((p) => [p, level(p, runde.get(p)!)]));

  /** Wen wuerde `p` annehmen, ohne schlechter dazustehen? */
  const nichtSchlechter = new Map<number, number[]>(
    sitzende.map((p) => [
      p,
      sitzende.filter((q) => q !== p && level(p, runde.get(q)!) >= eigenes.get(p)!),
    ]),
  );

  for (const start of sitzende) {
    for (const ziel of nichtSchlechter.get(start) ?? []) {
      // Nur echte Verbesserungen taugen als Ausloeser.
      if (level(start, runde.get(ziel)!) <= eigenes.get(start)!) continue;

      // Rueckweg von `ziel` nach `start` suchen; jede Kante darauf stellt
      // niemanden schlechter.
      const vorgaenger = new Map<number, number>([[ziel, ziel]]);
      const schlange = [ziel];
      while (schlange.length > 0) {
        const p = schlange.shift()!;
        if (p === start) break;
        for (const q of nichtSchlechter.get(p) ?? []) {
          if (vorgaenger.has(q)) continue;
          vorgaenger.set(q, p);
          schlange.push(q);
        }
      }
      if (!vorgaenger.has(start)) continue;

      // Rueckwaerts von `start` sammeln, bis `ziel` erreicht ist.
      const pfad: number[] = [];
      for (let p = start; ; p = vorgaenger.get(p)!) {
        pfad.push(p);
        if (p === ziel) break;
      }
      pfad.reverse(); // jetzt: ziel, ..., start

      // Der Ring in Zugrichtung: `start` zieht zu `ziel`, `ziel` zum naechsten,
      // und der letzte zurueck zu `start`. Das abschliessende `start` faellt
      // weg, weil der Ring sich ohnehin schliesst.
      return [start, ...pfad.slice(0, -1)];
    }
  }
  return null;
}
