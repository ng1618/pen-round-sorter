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

export function kennzahlen(a: Auslosung): Kennzahlen {
  const zaehler = new Map<number, number>();
  for (const z of a.zuordnungen) {
    if (z.receivedLevel == null) continue;
    zaehler.set(z.receivedLevel, (zaehler.get(z.receivedLevel) ?? 0) + 1);
  }

  return {
    plaetze: a.eingabestand.runden.reduce((s, r) => s + r.capacity, 0),
    spielende: a.eingabestand.spieler.length,
    jeLevel: LEVELS.map(({ level, emoji, label }) => ({
      level,
      label: `${emoji} ${label}`,
      anzahl: zaehler.get(level) ?? 0,
    })).filter((z) => z.anzahl > 0),
    ohnePlatz: a.zuordnungen.filter((z) => z.roundId == null).length,
  };
}

/**
 * Der Text, den man vor dem Festlegen herunterladen kann.
 *
 * Er ist zweierlei: Papier-Notausgang (wenn der Server ausfaellt, hast du das
 * Ergebnis trotzdem) und Ehrlichkeits-Nachweis — wer viermal ausgelost hat, hat
 * vier Dateien. Damit ersetzt er den gestrichenen `versuche`-Zaehler.
 */
export function protokollText(a: Auslosung, erzeugtAm = new Date()): string {
  const k = kennzahlen(a);
  const spielerVon = new Map(a.eingabestand.spieler.map((s) => [s.id, s]));
  const name = (id: number) => spielerVon.get(id)?.playerName ?? `#${id}`;

  const zeilen: string[] = [
    `Auslosung vom ${erzeugtAm.toLocaleString("de-DE")}`,
    `Verfahren: ${String(a.konfiguration.verfahren ?? "rsd")}${a.seed ? ` · Seed: ${a.seed}` : " · ohne Seed (nicht reproduzierbar)"}`,
    "",
    `${a.eingabestand.runden.length} Runden · ${k.plaetze} Plaetze · ${k.spielende} Spielende`,
    "",
    "Wie gut ist es aufgegangen:",
    ...k.jeLevel.map((z) => `  ${z.label}: ${z.anzahl}`),
    ...(k.ohnePlatz > 0 ? [`  ohne Platz: ${k.ohnePlatz}`] : []),
    "",
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
  zeilen.push("Losreihenfolge:");
  zeilen.push(`  ${a.losreihenfolge.map(name).join(", ")}`);

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
