import { LEVEL_STANDARD, type Assignment, type PlayerEntry, type Round } from "./types";

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Random Serial Dictatorship: players are visited in a random order and each
 * takes the best round still open to them. Fair and strategy-proof (ranking
 * honestly is always a player's best move), at the cost of not being globally
 * optimal.
 *
 * Zwei Dinge folgen aus den Levels statt einer geordneten Liste:
 *
 * 1. **Niemand bleibt uebrig, solange Plaetze da sind.** Jede Runde hat fuer
 *    jede Person ein Level — fehlt eins, gilt „geht auch". Wer nur seinen Namen
 *    abgeschickt hat, ist also ueberall zufrieden statt nirgends platzierbar.
 *    `roundId: null` heisst damit ausschliesslich Unterdeckung.
 * 2. **Gleichstand entscheidet der freiere Tisch.** Wem zwei Runden gleich
 *    lieb sind, den setzt der Matcher dorthin, wo mehr frei ist. Das kostet die
 *    Person nichts — sie hat ja gesagt, dass es ihr gleich ist — und haelt die
 *    knappe Runde fuer die frei, die sie wirklich wollen.
 */
export function runMatching(rounds: Round[], entries: PlayerEntry[]): Assignment[] {
  const capacityLeft = new Map(rounds.map((r) => [r.id, r.capacity]));

  return shuffled(entries).map((entry) => {
    const levelOf = new Map(entry.preferences.map((p) => [p.roundId, p.level]));
    const level = (roundId: number) => levelOf.get(roundId) ?? LEVEL_STANDARD;

    const offen = rounds
      .filter((r) => (capacityLeft.get(r.id) ?? 0) > 0)
      .sort((a, b) => {
        if (level(a.id) !== level(b.id)) return level(b.id) - level(a.id);
        return (capacityLeft.get(b.id) ?? 0) - (capacityLeft.get(a.id) ?? 0);
      });

    if (offen.length === 0) {
      return { playerId: entry.id, roundId: null, receivedLevel: null };
    }

    const gewaehlt = offen[0];
    capacityLeft.set(gewaehlt.id, (capacityLeft.get(gewaehlt.id) ?? 0) - 1);
    return { playerId: entry.id, roundId: gewaehlt.id, receivedLevel: level(gewaehlt.id) };
  });
}
