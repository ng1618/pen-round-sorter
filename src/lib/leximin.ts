import { shuffled } from "./matching.ts";
import { ungarisch } from "./ungarisch.ts";
import { MAX_SPIELENDE } from "./eingabe.ts";
import { LEVEL_STANDARD, type Assignment, type Level, type PlayerEntry, type Round } from "./types.ts";

/**
 * Leximin: **wie schlimm trifft es den, den es am härtesten trifft?**
 *
 * Nicht zu verwechseln mit „die Summe der Level maximieren". Das wäre ein
 * anderes Ziel und eine stillschweigende Modellannahme obendrein — die Zahlen
 * 3/2/1/0 sind Etiketten für vier Knöpfe, keine Nutzenwerte. Dass drei Schritte
 * von 🤷 auf ✨ genau ein 😬 aufwiegen, folgt aus nichts.
 *
 * Leximin kommt ohne diese Annahme aus. Es minimiert der Reihe nach:
 *
 * 1. wie viele **ohne Platz** bleiben,
 * 2. wie viele auf **😬 lieber nicht** landen,
 * 3. wie viele auf **🤷 geht auch**,
 * 4. wie viele auf **✨ gerne**.
 *
 * Erst wenn Stufe 1 gleich ist, entscheidet Stufe 2 — deshalb „lexikografisch".
 * Verglichen wird immer nur *innerhalb* einer Stufe, nie über Stufen hinweg.
 *
 * ⚠️ **Nicht manipulationsfest.** Wie jedes Verfahren, das ein Gesamtziel
 * optimiert: wer weiß, dass es läuft, kann mit unehrlichen Angaben gewinnen. Das
 * ist kein Umsetzungsfehler, sondern ein bewiesenes Ergebnis — RSD ist genau
 * deshalb manipulationsfest, *weil* es das Gesamtergebnis ignoriert. Deshalb
 * bleibt `rsd` die Vorgabe, und deshalb nennt das Protokoll das Verfahren.
 */

/**
 * Basis der gestuften Kosten. Muss **größer als die Höchstzahl Spielender**
 * sein, sonst könnte eine Menge der niedrigeren Stufe eine einzige der höheren
 * aufwiegen — und aus „lexikografisch" würde stillschweigend „gewichtete Summe".
 */
const BASIS = 10 * MAX_SPIELENDE;

/** Kosten je erhaltenem Level. Hohes Level = billig. */
const KOSTEN: Record<Level, number> = {
  3: 0,
  2: 1,
  1: BASIS,
  0: BASIS * BASIS,
};

/** Ein Scheinplatz, der „ohne Platz" bedeutet — teurer als jedes echte Level. */
const OHNE_PLATZ = BASIS * BASIS * BASIS;

export function runLeximin(rounds: Round[], entries: PlayerEntry[]): Assignment[] {
  if (entries.length === 0) return [];

  // Gemischt, weil Leximin deterministisch ist: bei mehreren gleich guten
  // Lösungen bekämen sonst immer dieselben Personen die guten Plätze. Die
  // Mischung ist der Gleichstandsentscheid — keine Ziehung, hier wird nichts
  // gezogen.
  const personen = shuffled(entries);
  const plaetze = shuffled(rounds.flatMap((r) => Array.from({ length: r.capacity }, () => r)));

  const levelVon = (person: PlayerEntry, rundenId: number): Level =>
    (person.preferences.find((p) => p.roundId === rundenId)?.level ?? LEVEL_STANDARD) as Level;

  // Zeilen sind Personen, Spalten sind **Plätze** — eine Runde mit fünf Plätzen
  // wird zu fünf Spalten. Fehlen Plätze, wird mit Scheinplätzen aufgefüllt;
  // wer dort landet, bleibt ohne Platz.
  const spalten = Math.max(plaetze.length, personen.length);
  const kosten = personen.map((person) =>
    Array.from({ length: spalten }, (_, j) =>
      j < plaetze.length ? KOSTEN[levelVon(person, plaetze[j].id)] : OHNE_PLATZ,
    ),
  );

  const gewaehlt = ungarisch(kosten);

  return personen.map((person, i) => {
    const spalte = gewaehlt[i];
    if (spalte < 0 || spalte >= plaetze.length) {
      return { playerId: person.id, roundId: null, receivedLevel: null };
    }
    const runde = plaetze[spalte];
    return { playerId: person.id, roundId: runde.id, receivedLevel: levelVon(person, runde.id) };
  });
}
