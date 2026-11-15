// Seed fuer lokale Durchlaeufe und die Generalproben.
//
// Aufruf:  npm run db:seed              — Runden UND 15 Spielende
//          npm run db:seed -- --nur-runden — nur die Runden, alle Plaetze frei
//          npm run db:seed -- --tage 3     — Tag 1 und 2 ausgelost und festgelegt,
//                                            Tag 3 laeuft (nur auf frischem Wochenende)
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
  commitLauf,
  einstellungen,
  listEntries,
  listRounds,
  neuerTag,
  resetAll,
  tagInfo,
  wochenendeAktualisieren,
} from "../src/lib/db/queries.ts";
import { reihenfolgeRegel, runMatching } from "../src/lib/matching.ts";

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
const tageArg = process.argv[process.argv.indexOf("--tage") + 1];
if (process.argv.includes("--tage") && tageArg !== "3") {
  console.error(`--tage kennt nur 3 (das Format des Novemberwochenendes), nicht ${tageArg}.`);
  process.exit(1);
}
const DREI_TAGE = tageArg === "3" && process.argv.includes("--tage");

if (DREI_TAGE) {
  // Nur auf Tag 1: ein Seed kann keinen Tag loeschen, nur den aktuellen neu
  // aufsetzen. Laege schon Tag 2 vor, entstuende ein Wochenende, dessen Tag 1
  // etwas ganz anderes erzaehlt als der Seed behauptet.
  const vorher = tagInfo();
  if (vorher.tag !== 1) {
    console.error(
      `Abbruch: es ist schon Tag ${vorher.tag}. --tage 3 braucht ein frisches Wochenende — ` +
        `.data/pen-round-sorter.db (samt -wal/-shm) loeschen und neu starten.`,
    );
    process.exit(1);
  }
}

resetAll();

// Schlaegt fehl, wenn schon mehr Tage angelegt sind als hier stehen — dann
// bleibt der bestehende Name stehen, statt den Seed abzubrechen.
const wochenende = wochenendeAktualisieren(WOCHENENDE.name, WOCHENENDE.tage);
if (!wochenende.ok) console.log(`Wochenende unveraendert: ${wochenende.fehler}`);

/**
 * Drehbuch fuer --tage 3 (Generalprobe 1 mit Tageswechsel). Tag 1 und 2 werden
 * ausgelost und festgelegt, Tag 3 ist der laufende Tag. Was man an Tag 3 im
 * Tresen sehen soll:
 *
 * - Bo und Ida leiten an Tag 2   → „Tag 1 ✓ · Tag 2 – · Tag 3 ✓"
 * - Mara, Nils, Ilva spielen nur an Tag 2 mit (an Tag 1 und 3 leiten sie)
 * - Svea leitet an Tag 2         → „Tag 1 ✓ · Tag 2 – · Tag 3 ✓"
 * - Sarah reicht an Tag 3 zweimal dasselbe ein  → kein Hinweis
 * - Jörg reicht an Tag 3 erst so, dann anders ein → „⚠️ Ranking 1× geändert"
 */
const TAG_2 = {
  runden: [
    { dmName: "Bo", title: "Die Glocke von Ostfenn", vibe: "Horror, leise", capacity: 5 },
    { dmName: "Ida", title: "Salz und Silber", vibe: "Seefahrt, Intrige", capacity: 5 },
    { dmName: "Svea", title: "Der letzte Zug nach Varn", vibe: "Krimi, schnell", capacity: 5 },
  ],
  mitRanking: [
    ...MIT_RANKING.filter((p) => p.name !== "Bo" && p.name !== "Ida"),
    { name: "Mara", muster: "topwunsch" },
    { name: "Nils", muster: "topUndAbneigung" },
    { name: "Ilva", muster: "allesGerne" },
  ],
  ohne: ["Paul"],
};

/** Einen Tag auslosen und festlegen — derselbe Weg wie Vorschau plus Festlegen. */
function auslosenUndFestlegen() {
  const r = listRounds();
  const s = listEntries();
  const zuordnungen = runMatching(r, s);
  commitLauf({
    seed: "",
    konfiguration: { ...einstellungen(), reihenfolge: reihenfolgeRegel(r, s) },
    eingabestand: { runden: r, spieler: s },
    losreihenfolge: zuordnungen.map((z) => z.playerId),
    zuordnungen,
  });
}

function tagFuellen(rundenDef, mitRanking, ohne) {
  // Nicht point-free: map() reicht den Index als zweites Argument durch, und
  // das landete im optionalen db-Parameter.
  const rr = rundenDef.map((r) => addRound(r));
  mitRanking.forEach(({ name, muster }, i) => {
    addEntry({ playerName: name, preferences: MUSTER[muster](rr, i) });
  });
  ohne.forEach((name) => addSpielerOhneEinreichung(name));
  return rr;
}

if (DREI_TAGE) {
  tagFuellen(RUNDEN, MIT_RANKING, OHNE_EINREICHUNG);
  auslosenUndFestlegen();
  if (!neuerTag().ok) throw new Error("Tag 2 liess sich nicht anlegen");

  tagFuellen(TAG_2.runden, TAG_2.mitRanking, TAG_2.ohne);
  auslosenUndFestlegen();
  if (!neuerTag().ok) throw new Error("Tag 3 liess sich nicht anlegen");
}

const runden = RUNDEN.map((r) => addRound(r));

if (!NUR_RUNDEN)
  MIT_RANKING.forEach(({ name, muster }, i) => {
    addEntry({ playerName: name, preferences: MUSTER[muster](runden, i) });
  });

if (!NUR_RUNDEN) OHNE_EINREICHUNG.forEach((name) => addSpielerOhneEinreichung(name));

if (DREI_TAGE && !NUR_RUNDEN) {
  // Mehrfach-Alarm vorfuehren: Sarah schickt dasselbe noch einmal (darf nicht
  // auffallen), Joerg zieht seinen Topwunsch auf eine andere Runde (muss).
  const sarahIndex = MIT_RANKING.findIndex((p) => p.name === "Sarah");
  addEntry({ playerName: "Sarah", preferences: MUSTER.topwunsch(runden, sarahIndex) });
  const joergIndex = MIT_RANKING.findIndex((p) => p.name === "Jörg");
  addEntry({ playerName: "Jörg", preferences: MUSTER.topwunsch(runden, joergIndex + 1) });
}

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
