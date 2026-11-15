import { LEVEL_STANDARD, type RoundPreference } from "./types.ts";

/**
 * Hat eine erneute Einreichung das Ranking wirklich geaendert?
 *
 * Grundlage des Mehrfach-Alarms. Verglichen werden nur die **Abweichungen vom
 * Standard**: „geht auch" wird nicht gespeichert, der alte Stand aus der
 * Datenbank kennt solche Zeilen also nie, der neue aus dem Formular vielleicht
 * schon. Ohne diese Angleichung meldete jede zweite Einreichung eine Aenderung,
 * die keine ist.
 *
 * Zweimal dasselbe ist bewusst **keine** Aenderung — das ist ein gewackeltes
 * Netz oder ein doppelter Tipp, keine zweite Person. Der Preis: zwei
 * verschiedene Menschen mit gleichem Namen und zufaellig gleichem Ranking
 * fallen nicht auf. Bei 15 Bekannten in Kauf genommen.
 */
export function rankingGeaendert(alt: RoundPreference[], neu: RoundPreference[]): boolean {
  const abweichungen = (r: RoundPreference[]) =>
    new Map(r.filter((p) => p.level !== LEVEL_STANDARD).map((p) => [p.roundId, p.level]));
  const a = abweichungen(alt);
  const n = abweichungen(neu);
  if (a.size !== n.size) return true;
  for (const [roundId, level] of n) {
    if (a.get(roundId) !== level) return true;
  }
  return false;
}
