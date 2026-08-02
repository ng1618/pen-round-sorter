import { LEVELS, LEVEL_TOP, type Level, type RoundPreference } from "./types.ts";

/**
 * Pruefung an der Routengrenze — fuer die beiden Routen, die **ohne Anmeldung**
 * schreiben duerfen, weil die Gaeste auf `/dm` und `/rank` sie brauchen.
 *
 * Zweck ist nicht Misstrauen gegen die eigene Oberflaeche, sondern zweierlei:
 * ein 5000-Zeichen-Name landete bisher ungeprueft in der Datenbank, und eine
 * verletzte `CHECK`- oder Index-Bedingung wurde zu einem 500 statt zu einem
 * 400 mit lesbarer Meldung.
 *
 * Reine Funktionen ohne Datenbankzugriff, damit sie ohne Aufbau pruefbar sind.
 *
 * **Zum Ton:** Eingabefehler sind im Wirtshaus-Ton gehalten — sie treffen Gaeste,
 * die sich vertippt haben, und duerfen freundlich sein. Der Sachverhalt steht
 * trotzdem immer dahinter ("... 5000 von hoechstens 80"), sonst weiss niemand,
 * was zu aendern ist. **Betriebsfehler bleiben nuechtern**: "Auslosung wurde
 * NICHT gespeichert" darf am Eventabend nicht in Prosa versteckt sein.
 */

export const MAX_NAME = 80;
export const MAX_TITEL = 120;
export const MAX_VIBE = 500;
export const MAX_PLAETZE = 20;
export const MAX_RUNDEN = 20;
export const MAX_SPIELENDE = 100;

export type Gepruft<T> = { ok: true; wert: T } | { ok: false; fehler: string };

function text(wert: unknown, feld: string, max: number, pflicht: boolean): Gepruft<string> {
  if (typeof wert !== "string") {
    return pflicht
      ? { ok: false, fehler: `📜 Das Pergament ist an dieser Stelle leer — ${feld} fehlt.` }
      : { ok: true, wert: "" };
  }
  const sauber = wert.trim();
  if (pflicht && sauber.length === 0) {
    return { ok: false, fehler: `📜 Der Schreiber wartet — ${feld} darf nicht leer sein.` };
  }
  if (sauber.length > max) {
    return {
      ok: false,
      fehler: `🐉 Hier enden die Karten: ${feld} ist zu lang (${sauber.length} von höchstens ${max}).`,
    };
  }
  return { ok: true, wert: sauber };
}

export type RundenEingabe = { dmName: string; title: string; vibe: string; capacity: number };

export function pruefeRunde(rumpf: unknown, vorhandeneRunden: number): Gepruft<RundenEingabe> {
  if (typeof rumpf !== "object" || rumpf === null) {
    return { ok: false, fehler: "🕯️ Der Bote brachte unleserliches Pergament." };
  }
  if (vorhandeneRunden >= MAX_RUNDEN) {
    return { ok: false, fehler: `🏰 Das Wirtshaus ist ausgebucht — mehr als ${MAX_RUNDEN} Runden gehen nicht.` };
  }

  const r = rumpf as Record<string, unknown>;
  const dmName = text(r.dmName, "Name", MAX_NAME, true);
  if (!dmName.ok) return dmName;
  const title = text(r.title, "Titel", MAX_TITEL, true);
  if (!title.ok) return title;
  const vibe = text(r.vibe, "Stimmung", MAX_VIBE, false);
  if (!vibe.ok) return vibe;

  const capacity = r.capacity;
  if (!Number.isInteger(capacity) || (capacity as number) < 1 || (capacity as number) > MAX_PLAETZE) {
    return {
      ok: false,
      fehler: `🪑 So viele Stühle hat der Wirt nicht: Platzzahl muss zwischen 1 und ${MAX_PLAETZE} liegen.`,
    };
  }

  return {
    ok: true,
    wert: { dmName: dmName.wert, title: title.wert, vibe: vibe.wert, capacity: capacity as number },
  };
}

export type EinreichungsEingabe = { playerName: string; preferences: RoundPreference[] };

export function pruefeEinreichung(
  rumpf: unknown,
  bekannteRunden: number[],
  vorhandeneSpieler: number,
): Gepruft<EinreichungsEingabe> {
  if (typeof rumpf !== "object" || rumpf === null) {
    return { ok: false, fehler: "🕯️ Der Bote brachte unleserliches Pergament." };
  }
  if (vorhandeneSpieler >= MAX_SPIELENDE) {
    return { ok: false, fehler: `🏰 Die Schankstube ist voll — mehr als ${MAX_SPIELENDE} Spielende gehen nicht.` };
  }

  const e = rumpf as Record<string, unknown>;
  const playerName = text(e.playerName, "Name", MAX_NAME, true);
  if (!playerName.ok) return playerName;

  const roh = e.preferences ?? [];
  if (!Array.isArray(roh)) {
    return { ok: false, fehler: "📜 Diese Wunschliste liest niemand — sie muss eine Liste sein." };
  }
  if (roh.length > bekannteRunden.length) {
    return { ok: false, fehler: "🎲 Mehr Wünsche als Tische — da ist einer zu viel." };
  }

  const erlaubteLevel = new Set<number>(LEVELS.map((l) => l.level));
  const gesehen = new Set<number>();
  const preferences: RoundPreference[] = [];

  for (const p of roh as Array<Record<string, unknown>>) {
    if (typeof p !== "object" || p === null) {
      return { ok: false, fehler: "🕯️ Ein Wunsch ist unleserlich." };
    }
    const { roundId, level } = p;
    if (!Number.isInteger(roundId) || !bekannteRunden.includes(roundId as number)) {
      return { ok: false, fehler: `🗺️ Runde ${String(roundId)} steht auf keiner Karte.` };
    }
    if (gesehen.has(roundId as number)) {
      return { ok: false, fehler: `👀 Runde ${String(roundId)} steht zweimal da — der Schreiber stutzt.` };
    }
    gesehen.add(roundId as number);
    if (!Number.isInteger(level) || !erlaubteLevel.has(level as number)) {
      return { ok: false, fehler: `🎲 Diesen Würfel gibt es nicht: Level ${String(level)}.` };
    }
    preferences.push({ roundId: roundId as number, level: level as Level });
  }

  // Die Datenbank erzwingt das ueber einen partiellen Index — hier wird daraus
  // ein 400 mit Begruendung statt eines 500.
  const top = preferences.filter((p) => p.level === LEVEL_TOP).length;
  if (top > 1) {
    return {
      ok: false,
      fehler: `🔥 Ein Herz schlägt nur für einen Tisch: nur eine Runde darf „unbedingt" sein, hier sind es ${top}.`,
    };
  }

  return { ok: true, wert: { playerName: playerName.wert, preferences } };
}
