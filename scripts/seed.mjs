// Seed fuer lokale Durchlaeufe und die Generalproben.
//
// Aufruf:  npm run db:seed              — Runden UND 15 Spielende
//          npm run db:seed -- --nur-runden — nur die Runden, alle Plaetze frei
//
// Die zweite Form ist die zum Selbertesten: 15 freie Plaetze, in die man vom
// Handy aus einreichen kann, ohne dass der Seed sie schon belegt.
//
// Schreibt ueber `db/queries.ts` statt mit eigenem SQL — damit es genau eine
// Definition davon gibt, wie ein Spieler geschrieben wird. Was hier laeuft, ist
// derselbe Weg, den die App nimmt.
//
// Drehbuch Generalprobe 1: 3 Runden a 5 Plaetze = 15 Plaetze fuer 15 Spielende,
// kein Puffer. Zwei davon reichen gar nichts ein.

import { closeDb } from "../src/lib/db/connection.ts";
import {
  addEntry,
  addRound,
  addSpielerOhneEinreichung,
  listEntries,
  listRounds,
  resetAll,
  tagInfo,
  wochenendeAktualisieren,
} from "../src/lib/db/queries.ts";

/**
 * Auch das Wochenende bekommt sinnvolle Werte. Ohne das stand ueber jedem
 * Durchlauf "Spieleabend" oder was von Hand eingetippt worden war, und
 * "Tag 1 von 1" verschweigt die Tagesanzeige und den Tageswechsel komplett —
 * also ausgerechnet die Teile, die man beim Durchspielen sehen will.
 *
 * Drei Tage wie das echte Format (Fr/Sa/So ab dem 20.11.).
 */
const WOCHENENDE = { name: "Novemberwochenende", tage: 3 };

const RUNDEN = [
  { dmName: "Mara", title: "Der Turm zu Kaltbruch", vibe: "duester, viel Reden", capacity: 5 },
  { dmName: "Nils", title: "Sumpf der Stillen Lieder", vibe: "Ermittlung, langsam", capacity: 5 },
  { dmName: "Ilva", title: "Drei Tage bis Mittwinter", vibe: "Klopperei, laut", capacity: 5 },
];

// Levels: 3 unbedingt (hoechstens einmal), 2 gerne, 1 geht auch, 0 lieber nicht.
const UNBEDINGT = 3;
const GERNE = 2;
const GEHT_AUCH = 1;
const LIEBER_NICHT = 0;

/**
 * Jede Person steht fuer ein Muster, das etwas anderes auf die Probe stellt.
 * `i` ist die laufende Nummer und dreht durch, welche Runde jeweils gemeint ist
 * — sonst haengen sich alle an dieselbe.
 */
const MUSTER = {
  /** Der Normalfall: ein Topwunsch, der Rest ist egal. */
  topwunsch: (runden, i) =>
    runden.map((r, k) => ({ roundId: r.id, level: k === i % runden.length ? UNBEDINGT : GEHT_AUCH })),

  /** Kein Favorit, aber ueberall gern. Lauter Gleichstand auf hohem Niveau. */
  allesGerne: (runden) => runden.map((r) => ({ roundId: r.id, level: GERNE })),

  /** Widerwillig, aber ein Tisch geht: prueft, dass Level 0 wirklich zuletzt kommt. */
  nurEinerGeht: (runden, i) =>
    runden.map((r, k) => ({ roundId: r.id, level: k === i % runden.length ? GERNE : LIEBER_NICHT })),

  /** Ausgepraegte Meinung in beide Richtungen. */
  topUndAbneigung: (runden, i) =>
    runden.map((r, k) => ({
      roundId: r.id,
      level:
        k === i % runden.length
          ? UNBEDINGT
          : k === (i + 1) % runden.length
            ? LIEBER_NICHT
            : GEHT_AUCH,
    })),

  /** Gar keine Lust, muss aber irgendwo sitzen — darf trotzdem nicht uebrig bleiben. */
  allesLieberNicht: (runden) => runden.map((r) => ({ roundId: r.id, level: LIEBER_NICHT })),
};

/** 13 Einreichungen; zusammen mit den 2 ohne Einreichung sind es 15 fuer 15 Plaetze. */
const MIT_RANKING = [
  { name: "Sarah", muster: "topwunsch" },
  { name: "Jörg", muster: "topwunsch" },
  { name: "Tomek", muster: "topwunsch" },
  { name: "Anneke", muster: "topwunsch" },
  { name: "Bo", muster: "topwunsch" },
  { name: "Lennart", muster: "allesGerne" },
  { name: "Yara", muster: "allesGerne" },
  { name: "Mirko", muster: "allesGerne" },
  { name: "Fenja", muster: "nurEinerGeht" },
  { name: "Ruben", muster: "nurEinerGeht" },
  { name: "Ida", muster: "topUndAbneigung" },
  { name: "Cem", muster: "topUndAbneigung" },
  { name: "Nora", muster: "allesLieberNicht" },
];

/** Nur der Name, sonst nichts — heisst "mir ist alles recht", nicht "nichts davon". */
const OHNE_EINREICHUNG = ["Paul", "Svea"];

const NUR_RUNDEN = process.argv.includes("--nur-runden");

resetAll();

// Schlaegt fehl, wenn schon mehr Tage angelegt sind als hier stehen — dann
// bleibt der bestehende Name stehen, statt den Seed abzubrechen.
const wochenende = wochenendeAktualisieren(WOCHENENDE.name, WOCHENENDE.tage);
if (!wochenende.ok) console.log(`Wochenende unveraendert: ${wochenende.fehler}`);

// Nicht point-free: map() reicht den Index als zweites Argument durch, und das
// landete im optionalen db-Parameter.
const runden = RUNDEN.map((r) => addRound(r));

if (!NUR_RUNDEN)
  MIT_RANKING.forEach(({ name, muster }, i) => {
    addEntry({ playerName: name, preferences: MUSTER[muster](runden, i) });
  });

if (!NUR_RUNDEN) OHNE_EINREICHUNG.forEach((name) => addSpielerOhneEinreichung(name));

const spieler = listEntries();
const plaetze = listRounds().reduce((summe, r) => summe + r.capacity, 0);
const eingereicht = spieler.filter((s) => s.submittedAt !== null).length;

const tag = tagInfo();

console.log(
  `Seed fertig: "${tag.name}", Tag ${tag.tag} von ${tag.tage} — ${runden.length} Runden, ` +
    `${plaetze} Plaetze, ${spieler.length} Spielende ` +
    `(${eingereicht} mit Einreichung, ${spieler.length - eingereicht} ohne).`,
);

if (!NUR_RUNDEN) {
  const jeMuster = new Map();
  for (const { muster } of MIT_RANKING) jeMuster.set(muster, (jeMuster.get(muster) ?? 0) + 1);
  for (const [muster, anzahl] of jeMuster) console.log(`  ${anzahl}x ${muster}`);
  console.log(`  ${OHNE_EINREICHUNG.length}x nurName`);
}

closeDb();
