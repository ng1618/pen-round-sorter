/**
 * Zuweisungsproblem mit minimalen Kosten — Ungarische Methode (Kuhn-Munkres) in
 * der O(n³)-Fassung mit Potentialen.
 *
 * Rein und ohne Datenbank, wie `matching.ts`: Kostenmatrix rein, Zuordnung raus.
 * Was die Kosten *bedeuten*, entscheidet der Aufrufer — dadurch trägt dieselbe
 * Maschinerie Leximin heute und jedes andere Ziel später, ohne dass hier etwas
 * angefasst werden muss.
 *
 * **Zeilen sind Personen, Spalten sind Plätze** (nicht Runden). Eine Runde mit
 * fünf Plätzen wird also zu fünf Spalten aufgefächert. So wird aus „Kapazität 5"
 * ein gewöhnliches Zuordnungsproblem — die Überlegung steht seit dem 29.07. in
 * `DATENBANK.md`.
 *
 * Bei 15 Personen auf 15 Plätzen ist die Laufzeit bedeutungslos; die Methode ist
 * gewählt, weil sie *exakt* ist und nicht, weil sie schnell ist.
 */

/**
 * @param kosten Zeile je Person, Spalte je Platz. **Es müssen mindestens so
 *   viele Spalten wie Zeilen sein** — der Aufrufer füllt mit Scheinplätzen auf.
 * @returns Für jede Zeile den Spaltenindex, oder -1, wenn sie leer bleibt.
 */
export function ungarisch(kosten: number[][]): number[] {
  const n = kosten.length;
  if (n === 0) return [];
  const m = kosten[0].length;
  if (m < n) {
    throw new Error(`Ungarische Methode: ${m} Spalten reichen fuer ${n} Zeilen nicht.`);
  }

  // Eins-basierte Hilfsfelder mit einer Sammelspalte 0 — das ist die übliche
  // Darstellung dieses Verfahrens und spart die Sonderbehandlung des Anfangs.
  const u = new Array<number>(n + 1).fill(0); // Potential je Zeile
  const v = new Array<number>(m + 1).fill(0); // Potential je Spalte
  const zeileZuSpalte = new Array<number>(m + 1).fill(0); // welche Zeile sitzt in Spalte j
  const weg = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    zeileZuSpalte[0] = i;
    let j0 = 0;
    const minimum = new Array<number>(m + 1).fill(Infinity);
    const benutzt = new Array<boolean>(m + 1).fill(false);

    // Kürzesten erweiternden Pfad suchen, bis eine freie Spalte erreicht ist.
    do {
      benutzt[j0] = true;
      const i0 = zeileZuSpalte[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j++) {
        if (benutzt[j]) continue;
        const jetzt = kosten[i0 - 1][j - 1] - u[i0] - v[j];
        if (jetzt < minimum[j]) {
          minimum[j] = jetzt;
          weg[j] = j0;
        }
        if (minimum[j] < delta) {
          delta = minimum[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= m; j++) {
        if (benutzt[j]) {
          u[zeileZuSpalte[j]] += delta;
          v[j] -= delta;
        } else {
          minimum[j] -= delta;
        }
      }
      j0 = j1;
    } while (zeileZuSpalte[j0] !== 0);

    // Pfad rückwärts abarbeiten und die Zuordnung umhängen.
    do {
      const j1 = weg[j0];
      zeileZuSpalte[j0] = zeileZuSpalte[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const ergebnis = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    if (zeileZuSpalte[j] !== 0) ergebnis[zeileZuSpalte[j] - 1] = j - 1;
  }
  return ergebnis;
}

/** Summe der Kosten einer Zuordnung — für Tests und Vergleiche. */
export function kostenSumme(kosten: number[][], zuordnung: number[]): number {
  return zuordnung.reduce((summe, spalte, zeile) => summe + (spalte < 0 ? 0 : kosten[zeile][spalte]), 0);
}
