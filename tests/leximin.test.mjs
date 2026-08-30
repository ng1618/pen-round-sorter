// Leximin. Aufruf: npm test
//
// Zwei Sorten Prüfungen: dieselben Invarianten wie für RSD (das Ergebnis muss
// überhaupt gültig sein), und die eigentliche Aussage — dass Leximin die
// schlechten Stufen leert, notfalls auf Kosten der guten.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runLeximin } from "../src/lib/leximin.ts";
import { runMatching } from "../src/lib/matching.ts";

const LAEUFE = 100;

function runden(...plaetze) {
  return plaetze.map((p, i) => ({
    id: i + 1,
    dmName: `DM${i + 1}`,
    title: `Runde ${i + 1}`,
    vibe: "",
    capacity: p,
    createdAt: 0,
  }));
}

function spieler(anzahl, levels = () => ({})) {
  return Array.from({ length: anzahl }, (_, i) => ({
    id: i + 1,
    playerName: `P${i + 1}`,
    preferences: Object.entries(levels(i)).map(([roundId, level]) => ({
      roundId: Number(roundId),
      level,
    })),
    submittedAt: 0,
    createdAt: 0,
  }));
}

/** Wie viele Personen auf welcher Stufe gelandet sind, `null` = ohne Platz. */
function verteilung(zuordnungen) {
  const z = { ohne: 0, 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const a of zuordnungen) {
    if (a.roundId == null) z.ohne++;
    else z[a.receivedLevel]++;
  }
  return z;
}

/** Leximin-Vergleich: kleiner ist besser, der Reihe nach. */
function schlechterAls(a, b) {
  for (const stufe of ["ohne", 0, 1, 2]) {
    if (a[stufe] !== b[stufe]) return a[stufe] > b[stufe];
  }
  return false;
}

test("Leximin: keine Runde wird ueberbelegt", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, () => ({ 1: 3 }));
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const proRunde = new Map();
    for (const a of runLeximin(r, s)) {
      if (a.roundId == null) continue;
      proRunde.set(a.roundId, (proRunde.get(a.roundId) ?? 0) + 1);
    }
    for (const runde of r) {
      assert.ok((proRunde.get(runde.id) ?? 0) <= runde.capacity, `Lauf ${lauf}: ${runde.id} voll`);
    }
  }
});

test("Leximin: jede Person kommt genau einmal vor", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, (i) => ({ 1: 3, 2: i % 2 }));
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const ids = runLeximin(r, s).map((a) => a.playerId);
    assert.equal(ids.length, 15, `Lauf ${lauf}`);
    assert.equal(new Set(ids).size, 15, `Lauf ${lauf}`);
  }
});

test("Leximin: niemand bleibt uebrig, solange Plaetze da sind", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, () => ({ 1: 0, 2: 0, 3: 0 })); // alle wollen nirgends hin
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    for (const a of runLeximin(r, s)) {
      assert.notEqual(a.roundId, null, `Lauf ${lauf}: Person ${a.playerId} ohne Platz`);
    }
  }
});

test("Leximin: bei Unterdeckung fehlen genau so viele Plaetze wie rechnerisch", () => {
  const r = runden(3, 3, 3); // 9 Plaetze
  const s = spieler(14);
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    assert.equal(verteilung(runLeximin(r, s)).ohne, 5, `Lauf ${lauf}`);
  }
});

test("Leximin: das erhaltene Level passt zur Angabe der Person", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, (i) => ({ 1: 3, 2: 2, 3: i % 2 === 0 ? 0 : 1 }));
  const levelVon = (p, id) => p.preferences.find((x) => x.roundId === id)?.level ?? 1;
  for (const a of runLeximin(r, s)) {
    const person = s.find((p) => p.id === a.playerId);
    if (a.roundId == null) assert.equal(a.receivedLevel, null);
    else assert.equal(a.receivedLevel, levelVon(person, a.roundId));
  }
});

test("Leximin ist nie leximin-schlechter als RSD", () => {
  // Die zentrale Aussage. Leximin loest das Ziel exakt; RSD ist ein
  // Naeherungsverfahren mit anderem Zweck. Also darf RSD nie besser sein.
  const r = runden(5, 5, 5);
  const s = spieler(15, (i) => ({ 1: 3, 2: i % 3 === 0 ? 0 : 2, 3: i % 2 }));
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const lex = verteilung(runLeximin(r, s));
    const rsd = verteilung(runMatching(r, s));
    assert.ok(!schlechterAls(lex, rsd), `Lauf ${lauf}: leximin ${JSON.stringify(lex)} < rsd ${JSON.stringify(rsd)}`);
  }
});

test("Leximin raeumt die schlechteste Stufe leer, wo RSD sie besetzt laesst", () => {
  // Gebauter Fall: zwei Runden a 2 Plaetzen, vier Personen. Drei wollen
  // unbedingt in Runde 1 und finden Runde 2 unertraeglich; eine ist umgekehrt.
  // Wer in Runde 1 keinen Platz bekommt, landet zwangslaeufig auf 😬 — es sei
  // denn, die vierte Person raeumt Runde 1 und geht in ihre eigene Wunschrunde.
  const r = runden(2, 2);
  const s = [
    { id: 1, playerName: "A", preferences: [{ roundId: 1, level: 3 }, { roundId: 2, level: 0 }], submittedAt: 0, createdAt: 0 },
    { id: 2, playerName: "B", preferences: [{ roundId: 1, level: 3 }, { roundId: 2, level: 0 }], submittedAt: 0, createdAt: 0 },
    { id: 3, playerName: "C", preferences: [{ roundId: 1, level: 3 }, { roundId: 2, level: 0 }], submittedAt: 0, createdAt: 0 },
    { id: 4, playerName: "D", preferences: [{ roundId: 2, level: 3 }, { roundId: 1, level: 0 }], submittedAt: 0, createdAt: 0 },
  ];

  // Vier Personen, vier Plaetze: einer der drei muss nach Runde 2 und dort auf
  // 😬. Weniger als ein 😬 geht nicht — aber mehr als eines eben auch nicht,
  // und genau das garantiert Leximin.
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const lex = verteilung(runLeximin(r, s));
    assert.equal(lex.ohne, 0, `Lauf ${lauf}`);
    assert.equal(lex[0], 1, `Lauf ${lauf}: genau ein 😬 ist das Beste, was geht`);
    assert.equal(lex[3], 3, `Lauf ${lauf}: drei bekommen ihren Topwunsch`);
  }
});

test("Leximin waehlt nicht immer dieselben Personen aus", () => {
  // Der Gleichstandsentscheid muss wirken: ohne das Mischen bekaemen bei
  // gleichwertigen Loesungen stets dieselben die guten Plaetze.
  const r = runden(1, 1);
  const s = spieler(2, () => ({ 1: 3, 2: 2 })); // beide wollen dasselbe
  const gesehen = new Set();
  for (let lauf = 0; lauf < 200; lauf++) {
    const a = runLeximin(r, s);
    gesehen.add(a.find((x) => x.receivedLevel === 3).playerId);
  }
  assert.equal(gesehen.size, 2, "immer dieselbe Person bekam den Topwunsch");
});

test("Gleichgueltigkeit zieht den Kuerzeren", () => {
  // Nora hat jede Runde mit 😬 markiert — ihr Level aendert sich durch die
  // Platzierung nicht, sie traegt also einen festen Beitrag zum Ziel bei. Genau
  // deshalb raeumt Leximin von sich aus den Platz, den Ruben unbedingt will:
  // Nora umzusetzen kostet nichts, Ruben zu verschieben kostet zwei Stufen.
  const r = runden(1, 1);
  const s = [
    { id: 1, playerName: "Nora", preferences: [{ roundId: 1, level: 0 }, { roundId: 2, level: 0 }], submittedAt: 0, createdAt: 0 },
    { id: 2, playerName: "Ruben", preferences: [{ roundId: 2, level: 3 }, { roundId: 1, level: 0 }], submittedAt: 0, createdAt: 0 },
  ];

  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const a = runLeximin(r, s);
    const ruben = a.find((x) => x.playerId === 2);
    const nora = a.find((x) => x.playerId === 1);
    assert.equal(ruben.roundId, 2, `Lauf ${lauf}: Ruben bekam nicht seinen Wunsch`);
    assert.equal(nora.roundId, 1, `Lauf ${lauf}: Nora hat nicht geraeumt`);
  }
});

test("wer eine echte Abneigung hat, zieht NICHT den Kuerzeren", () => {
  // Die Gegenprobe und die Grenze der Regel: Ida ist nicht gleichgueltig, sie
  // hat eine Abneigung gegen Runde 1. Leximin opfert sie nicht, um Rubens
  // Topwunsch zu erfuellen — es zaehlt Stufen, nicht Enttaeuschungen.
  const r = runden(1, 1);
  const s = [
    { id: 1, playerName: "Ida", preferences: [{ roundId: 1, level: 0 }, { roundId: 2, level: 1 }], submittedAt: 0, createdAt: 0 },
    { id: 2, playerName: "Ruben", preferences: [{ roundId: 2, level: 3 }, { roundId: 1, level: 1 }], submittedAt: 0, createdAt: 0 },
  ];

  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const a = runLeximin(r, s);
    const ida = a.find((x) => x.playerId === 1);
    assert.notEqual(ida.roundId, 1, `Lauf ${lauf}: Ida wurde auf ihre Abneigung gesetzt`);
  }
});
