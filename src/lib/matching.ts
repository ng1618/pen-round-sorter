import { LEVEL_STANDARD, type Assignment, type PlayerEntry, type Round } from "./types.ts";

/**
 * Fisher-Yates, rueckwaerts und einschliesslich `i` — das `i + 1` ist der Punkt:
 * mit `Math.random() * i` koennte kein Element auf seinem Platz bleiben, und die
 * Verteilung waere nachweislich schief.
 *
 * Exportiert, weil Leximin dieselbe Mischung fuer seinen Gleichstandsentscheid
 * braucht. Eine zweite Fassung waere die Stelle, an der spaeter ein gesaeter
 * Zufallsgenerator nur in einer von beiden ankaeme.
 */
export function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Unterscheiden die Angaben dieser Person ueberhaupt eine Runde von einer
 * anderen? Wer ueberall dasselbe Level stehen hat — auch wer gar nichts
 * eingereicht hat — ist gleichgueltig im Wortsinn: jeder Tisch ist ihm recht.
 */
function hatWunsch(entry: PlayerEntry, rounds: Round[]): boolean {
  if (rounds.length === 0) return false;
  const levelOf = new Map(entry.preferences.map((p) => [p.roundId, p.level]));
  const level = (roundId: number) => levelOf.get(roundId) ?? LEVEL_STANDARD;
  const erstes = level(rounds[0].id);
  return rounds.some((r) => level(r.id) !== erstes);
}

export type ReihenfolgeRegel = "wunsch-zuerst" | "einheitlich";

/**
 * Welche Losreihenfolge gilt — die Bedingung steht bewusst nur hier.
 *
 * Das Protokoll muss dieselbe Antwort bekommen wie der Matcher, sonst behauptet
 * der Ausdruck eine Regel, nach der gar nicht gelost wurde.
 */
export function reihenfolgeRegel(rounds: Round[], entries: PlayerEntry[]): ReihenfolgeRegel {
  const plaetze = rounds.reduce((summe, r) => summe + r.capacity, 0);
  return plaetze >= entries.length ? "wunsch-zuerst" : "einheitlich";
}

/**
 * Random Serial Dictatorship: players are visited in a random order and each
 * takes the best round still open to them. Fair and strategy-proof (ranking
 * honestly is always a player's best move), at the cost of not being globally
 * optimal.
 *
 * Drei Dinge folgen aus den Levels statt einer geordneten Liste:
 *
 * 1. **Niemand bleibt uebrig, solange Plaetze da sind.** Jede Runde hat fuer
 *    jede Person ein Level — fehlt eins, gilt „geht auch". Wer nur seinen Namen
 *    abgeschickt hat, ist also ueberall zufrieden statt nirgends platzierbar.
 *    `roundId: null` heisst damit ausschliesslich Unterdeckung.
 * 2. **Gleichstand entscheidet der freiere Tisch.** Wem zwei Runden gleich
 *    lieb sind, den setzt der Matcher dorthin, wo mehr frei ist. Das kostet die
 *    Person nichts — sie hat ja gesagt, dass es ihr gleich ist — und haelt die
 *    knappe Runde fuer die frei, die sie wirklich wollen.
 * 3. **Gleichgueltige werden zuletzt gezogen — aber nur, wenn die Plaetze
 *    reichen.** Das ist keine neue Fairnessregel, sondern die Reparatur von
 *    Punkt 2: der freiere Tisch kann nur schuetzen, wenn die Belegung schon
 *    etwas aussagt. Am Anfang sind alle Tische gleich leer, der Vergleich ist
 *    ein Gleichstand, und weil `sort` stabil ist, gewinnt schlicht die Runde
 *    mit der kleinsten Id. Frueh gezogene Gleichgueltige werden also nach
 *    Listenreihenfolge verteilt statt nach Bedarf — und koennen dabei den
 *    knappen Tisch belegen, den Punkt 2 freihalten wollte.
 *
 *    Bei **Unterdeckung** gilt die Regel nicht. Dann hiesse „zuletzt" naemlich
 *    „vielleicht gar kein Platz", und die Regel bestrafte genau die, die
 *    ehrlich gesagt haben, dass sie flexibel sind. Solange Plaetze >= Spielende
 *    ist, entscheidet die Reihenfolge nur das WO, nie das OB — deshalb kostet
 *    sie dort niemanden etwas, und deshalb lohnt auch kein erfundenes 🔥: der
 *    Platz ist ohnehin sicher, und die Lüge setzt einen an einen Tisch, den man
 *    nicht wollte.
 */
export function runMatching(rounds: Round[], entries: PlayerEntry[]): Assignment[] {
  const capacityLeft = new Map(rounds.map((r) => [r.id, r.capacity]));

  const mitWunsch: PlayerEntry[] = [];
  const gleichgueltig: PlayerEntry[] = [];
  for (const entry of entries) {
    (hatWunsch(entry, rounds) ? mitWunsch : gleichgueltig).push(entry);
  }

  // Innerhalb der Gruppen wird weiterhin gelost — die Reihenfolge unter den
  // Begeisterten ist die eigentliche Verlosung und bleibt unberuehrt.
  const reihenfolge =
    reihenfolgeRegel(rounds, entries) === "wunsch-zuerst"
      ? [...shuffled(mitWunsch), ...shuffled(gleichgueltig)]
      : shuffled(entries);

  return reihenfolge.map((entry) => {
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
