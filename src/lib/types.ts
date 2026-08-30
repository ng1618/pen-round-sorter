export type Round = {
  id: number;
  dmName: string;
  title: string;
  vibe: string;
  capacity: number;
  createdAt: number;
};

/**
 * Wie sehr jemand in eine Runde will. Die Zahl ist das gespeicherte Gewicht
 * (hoch = stark) und taucht in der Oberflaeche nie auf — dort stehen Worte.
 */
export const LEVELS = [
  { level: 3, emoji: "🔥", label: "unbedingt" },
  { level: 2, emoji: "✨", label: "gerne" },
  { level: 1, emoji: "🤷", label: "geht auch" },
  { level: 0, emoji: "😬", label: "lieber nicht" },
] as const;

export type Level = (typeof LEVELS)[number]["level"];

/** Was eine unberuehrte Runde bedeutet: „geht auch". */
export const LEVEL_STANDARD: Level = 1;

/** Hoechstens einmal je Person — sonst hiesse „Erstwunsch" nichts mehr. */
export const LEVEL_TOP: Level = 3;

export type RoundPreference = { roundId: number; level: Level };

export type PlayerEntry = {
  id: number;
  playerName: string;
  /**
   * Nur die abweichenden Runden muessen drinstehen; was fehlt, gilt als
   * `LEVEL_STANDARD`. Wer nur seinen Namen abschickt, hat gar keine Eintraege
   * — das heisst „mir ist alles recht", nicht „nichts davon".
   */
  preferences: RoundPreference[];
  /** null = angelegt, aber nie eingereicht. */
  submittedAt: number | null;
  createdAt: number;
};

export type Assignment = {
  playerId: number;
  /** null heisst wirklich Unterdeckung — nie mehr „hat zu wenig gerankt". */
  roundId: number | null;
  /** Das Level, das die Person bekommen hat. 3 = ihr Topwunsch. */
  receivedLevel: Level | null;
};

/**
 * Verfahren der Auslosung.
 *
 * `rsd` — Random Serial Dictatorship: zufaellige Reihenfolge, jeder nimmt den
 * besten noch freien Tisch. Manipulationsfest, dafuer nicht global optimal.
 *
 * `leximin` — minimiert der Reihe nach: wie viele ohne Platz bleiben, dann wie
 * viele auf der schlechtesten Stufe landen, dann auf der zweitschlechtesten.
 * Fragt also "wie schlimm trifft es den, den es am haertesten trifft?" statt
 * "wie viel Zufriedenheit kommt zusammen?". **Nicht manipulationsfest** — wie
 * jedes Verfahren, das ein Gesamtziel optimiert. Siehe ENTSCHEIDUNGEN.md.
 */
export type Verfahren = "rsd" | "leximin";

/**
 * Was fuer das ganze Wochenende gilt. Liegt als JSON in
 * `wochenende.einstellungen` — eine Spalte statt einer je Schalter, sonst
 * braeuchte jeder neue Schalter eine eigene Migration.
 */
export type Einstellungen = {
  verfahren: Verfahren;
  /**
   * Wer an einem frueheren Tag seinen Topwunsch nicht bekam, wird spaeter
   * frueher gezogen. Noch ohne Wirkung — die Umsetzung braucht die
   * Teilnehmerliste (Phase 4).
   */
  ausgleichUeberTage: boolean;
};

/**
 * Was gilt, solange nichts eingestellt wurde. `rsd` bleibt die Vorgabe, weil
 * die Manipulationsfestigkeit die Fairnessbegruendung des Projekts traegt —
 * das Optimum muss man ausdruecklich waehlen.
 */
export const EINSTELLUNGEN_STANDARD: Einstellungen = {
  verfahren: "rsd",
  ausgleichUeberTage: false,
};
