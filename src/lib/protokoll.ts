import { LEVELS, LEVEL_STANDARD, type Assignment, type PlayerEntry, type Round } from "./types.ts";

/**
 * Kennzahlen und Protokolltext zu einer Auslosung.
 *
 * Reine Funktionen, absichtlich ohne Datenbank: dieselbe Auslosung soll vor dem
 * Festlegen (Vorschau) und danach (gespeicherter Lauf) identisch ausgewertet
 * werden. Zwei Auswertungen waeren zwei Wahrheiten.
 */

export type Auslosung = {
  seed: string;
  konfiguration: Record<string, unknown>;
  eingabestand: { runden: Round[]; spieler: PlayerEntry[] };
  losreihenfolge: number[];
  zuordnungen: Assignment[];
};

export type Kennzahlen = {
  plaetze: number;
  spielende: number;
  jeLevel: Array<{ level: number; label: string; anzahl: number }>;
  ohnePlatz: number;
};

/**
 * Wie viele Personen welches Level bekommen haben, hohes zuerst.
 *
 * Eigene Funktion, weil das festgelegte Ergebnis dieselbe Zahl braucht, ohne
 * eine ganze `Auslosung` zur Hand zu haben — bis zum 30.08. rechnete die
 * Verwaltung sie deshalb ein zweites Mal selbst aus.
 */
export function levelVerteilung(zuordnungen: Assignment[]): Kennzahlen["jeLevel"] {
  const zaehler = new Map<number, number>();
  for (const z of zuordnungen) {
    if (z.receivedLevel == null) continue;
    zaehler.set(z.receivedLevel, (zaehler.get(z.receivedLevel) ?? 0) + 1);
  }

  return LEVELS.map(({ level, emoji, label }) => ({
    level,
    label: `${emoji} ${label}`,
    anzahl: zaehler.get(level) ?? 0,
  })).filter((z) => z.anzahl > 0);
}

export function kennzahlen(a: Auslosung): Kennzahlen {
  return {
    plaetze: a.eingabestand.runden.reduce((s, r) => s + r.capacity, 0),
    spielende: a.eingabestand.spieler.length,
    jeLevel: levelVerteilung(a.zuordnungen),
    ohnePlatz: a.zuordnungen.filter((z) => z.roundId == null).length,
  };
}

/**
 * Wie die Losreihenfolge zustande kam, in Worten.
 *
 * Ein unbekannter oder fehlender Wert bekommt **keinen** Satz. Lieber gar keine
 * Erklaerung als eine falsche: der Ausdruck ist das, was am Eventabend
 * aushaengt, und „erst die mit einem Wunsch" unter einer Reihenfolge, die gar
 * nicht so entstanden ist, waere eine Falschaussage ueber das Verfahren.
 */
const REIHENFOLGE_ERKLAERUNG: Record<string, string> = {
  "wunsch-zuerst":
    "  (erst die mit einem Wunsch, dann die ohne — beide Gruppen zufaellig.\n" +
    "   Plaetze reichen fuer alle, die Reihenfolge entscheidet also nur den Tisch)",
  einheitlich:
    "  (rein zufaellig — bei Unterdeckung wird nicht nach Wuenschen vorsortiert,\n" +
    "   sonst haetten die ohne Wunsch das Nachsehen beim Platz selbst)",
  uebernommen:
    "  (nicht neu gelost — Reihenfolge aus dem vorherigen Lauf uebernommen,\n" +
    "   wer seither dazugekommen ist, steht hinten)",
  gleichstand:
    "  (hier wurde nicht gelost, sondern gerechnet. Die Reihenfolge entschied\n" +
    "   nur bei gleich guten Loesungen, wer den besseren Platz bekam)",
};

/** Ein Satz zum Verfahren — mit dem Vorbehalt, wo einer noetig ist. */
const VERFAHREN_ERKLAERUNG: Record<string, string> = {
  rsd:
    "  Losverfahren: zufaellige Reihenfolge, jeder nimmt den besten noch freien\n" +
    "  Tisch. Manipulationsfest — ehrlich anzugeben ist immer der beste Zug.",
  leximin:
    "  Leximin: minimiert der Reihe nach, wie viele ohne Platz bleiben, dann wie\n" +
    "  viele auf der schlechtesten Stufe landen, dann auf der zweitschlechtesten.\n" +
    "  ACHTUNG: nicht manipulationsfest — wer weiss, dass es laeuft, kann mit\n" +
    "  unehrlichen Angaben gewinnen.",
};

/**
 * Der Text, den man vor dem Festlegen herunterladen kann.
 *
 * Er ist zweierlei: Papier-Notausgang (wenn der Server ausfaellt, hast du das
 * Ergebnis trotzdem) und Ehrlichkeits-Nachweis — wer viermal ausgelost hat, hat
 * vier Dateien. Damit ersetzt er den gestrichenen `versuche`-Zaehler.
 */
/**
 * Zeilen zu Platzzahlen, die **nach** der Auslosung geaendert wurden — in
 * Ruecksprache mit der Leitung, wenn es sonst keine gute Loesung gab.
 */
function plaetzeGeaendert(a: Auslosung): string[] {
  const aenderungen = a.konfiguration.plaetzeNachtraeglich;
  if (!Array.isArray(aenderungen) || aenderungen.length === 0) return [];

  return [
    "Platzzahl nachtraeglich geaendert (mit der Leitung abgesprochen):",
    ...aenderungen.map((x) => {
      const { titel, von, auf } = x as { titel: string; von: number; auf: number };
      return `  ${titel}: ${von} -> ${auf}`;
    }),
    "",
  ];
}

export function protokollText(a: Auslosung, erzeugtAm = new Date()): string {
  const k = kennzahlen(a);
  const spielerVon = new Map(a.eingabestand.spieler.map((s) => [s.id, s]));
  const name = (id: number) => spielerVon.get(id)?.playerName ?? `#${id}`;

  const zeilen: string[] = [
    `Auslosung vom ${erzeugtAm.toLocaleString("de-DE")}`,
    `Verfahren: ${String(a.konfiguration.verfahren ?? "rsd")}${a.seed ? ` · Seed: ${a.seed}` : " · ohne Seed (nicht reproduzierbar)"}`,
    ...(VERFAHREN_ERKLAERUNG[String(a.konfiguration.verfahren ?? "rsd")] ?? "").split("\n").filter(Boolean),
    "",
    `${a.eingabestand.runden.length} Runden · ${k.plaetze} Plaetze · ${k.spielende} Spielende`,
    "",
    "Wie gut ist es aufgegangen:",
    ...k.jeLevel.map((z) => `  ${z.label}: ${z.anzahl}`),
    ...(k.ohnePlatz > 0 ? [`  ohne Platz: ${k.ohnePlatz}`] : []),
    "",
    // Nachtraeglich aufgestockte Tische muessen als solche kenntlich sein.
    // Sonst liest sich der Ausdruck, als haette die Runde von Anfang an sechs
    // Plaetze gehabt — und das Ergebnis waere nicht mehr nachvollziehbar.
    ...plaetzeGeaendert(a),
  ];

  for (const runde of a.eingabestand.runden) {
    const sitzend = a.zuordnungen.filter((z) => z.roundId === runde.id);
    zeilen.push(`${runde.title} — Leitung ${runde.dmName} (${sitzend.length}/${runde.capacity})`);
    for (const z of sitzend) zeilen.push(`  - ${name(z.playerId)}`);
    zeilen.push("");
  }

  const ohne = a.zuordnungen.filter((z) => z.roundId == null);
  if (ohne.length > 0) {
    zeilen.push(`Ohne Platz (${ohne.length}):`);
    for (const z of ohne) zeilen.push(`  - ${name(z.playerId)}`);
    zeilen.push("");
  }

  // Sichtbar machen, wer in welcher Reihenfolge gezogen wurde — Abschnitt 2 des
  // Arbeitsdokuments: "ein nachvollziehbares Losverfahren wird akzeptiert".
  //
  // Mit der Regel dazu, sonst sieht die Reihenfolge willkuerlich aus und die
  // Frage "warum kam der zuerst dran?" hat am Eventabend keine Antwort.
  zeilen.push("Losreihenfolge:");
  zeilen.push(`  ${a.losreihenfolge.map(name).join(", ")}`);
  const erklaerung = REIHENFOLGE_ERKLAERUNG[String(a.konfiguration.reihenfolge)];
  if (erklaerung) zeilen.push(erklaerung);

  return zeilen.join("\n");
}

/**
 * Die **Einreichungen** als Text — der Stand VOR dem Auslosen.
 *
 * Zweck ist der Papier-Notausgang. Faellt der Server aus, nachdem alle
 * eingereicht haben, sind sonst die Wuensche weg und man loste bei null an.
 * Das Protokoll deckt nur die andere Haelfte ab, naemlich das Ergebnis.
 *
 * Enthaelt deshalb genug, um von Hand auszulosen: wer was will, wie viele
 * Plaetze es gibt, und wie beliebt die Tische sind.
 */
export function einreichungenText(
  runden: Round[],
  spieler: PlayerEntry[],
  erzeugtAm = new Date(),
): string {
  const plaetze = runden.reduce((s, r) => s + r.capacity, 0);
  const eingereicht = spieler.filter((s) => s.submittedAt !== null).length;
  const marke = (level: number) => LEVELS.find((l) => l.level === level)?.emoji ?? "?";

  const zeilen: string[] = [
    `Einreichungen, Stand ${erzeugtAm.toLocaleString("de-DE")}`,
    "",
    `${runden.length} Runden · ${plaetze} Plaetze · ${spieler.length} Spielende ` +
      `(${eingereicht} haben eingereicht)`,
    ...(plaetze < spieler.length
      ? [`ACHTUNG Unterdeckung: ${spieler.length - plaetze} Spielende mehr als Plaetze.`]
      : []),
    "",
    "Runden:",
    ...runden.map((r) => `  [${r.id}] ${r.title} — Leitung ${r.dmName} — ${r.capacity} Plaetze`),
    "",
    "Wuensche:",
  ];

  for (const person of spieler) {
    if (person.submittedAt === null) {
      zeilen.push(`  ${person.playerName} — nichts eingereicht (gilt als: alles geht auch)`);
      continue;
    }
    const abweichend = person.preferences
      .filter((p) => p.level !== LEVEL_STANDARD)
      .sort((a, b) => b.level - a.level)
      .map((p) => `${marke(p.level)} [${p.roundId}]`);
    zeilen.push(
      `  ${person.playerName} — ${abweichend.length ? abweichend.join(" ") : "alles geht auch"}`,
    );
  }

  zeilen.push("", "Beliebtheit je Runde:");
  for (const r of runden) {
    const zaehl = LEVELS.map(({ level, emoji }) => {
      const n = spieler.filter((s) => levelVon(s, r.id) === level).length;
      return n > 0 ? `${emoji} ${n}` : null;
    }).filter(Boolean);
    zeilen.push(`  [${r.id}] ${r.title}: ${zaehl.join(" · ")}`);
  }

  return zeilen.join("\n");
}

/** Level, das diese Person fuer diese Runde angegeben hat. Fehlt es, gilt der Standard. */
export function levelVon(spieler: PlayerEntry, rundenId: number): number {
  return spieler.preferences.find((p) => p.roundId === rundenId)?.level ?? LEVEL_STANDARD;
}
