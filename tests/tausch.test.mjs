// Die Tauschrunde (Top Trading Cycles auf einer bestehenden Sitzordnung).
// Aufruf: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { tauschrunde } from "../src/lib/tausch.ts";
import { runMatching } from "../src/lib/matching.ts";

const person = (id, name, prefs) => ({
  id,
  playerName: name,
  preferences: Object.entries(prefs).map(([roundId, level]) => ({ roundId: Number(roundId), level })),
  submittedAt: 0,
  createdAt: 0,
});

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

const belegung = (zuordnungen) => {
  const m = new Map();
  for (const z of zuordnungen) if (z.roundId != null) m.set(z.roundId, (m.get(z.roundId) ?? 0) + 1);
  return m;
};

test("ein Dreierring wird gefunden und aufgeloest", () => {
  // A sitzt in 1 und will in 2, B sitzt in 2 und will in 3, C sitzt in 3 und
  // will in 1. Von Hand sieht man das nicht — paarweise tauschen bringt keinem
  // etwas, nur der Ring über alle drei.
  const spieler = [
    person(1, "A", { 1: 1, 2: 3, 3: 0 }),
    person(2, "B", { 2: 1, 3: 3, 1: 0 }),
    person(3, "C", { 3: 1, 1: 3, 2: 0 }),
  ];
  const vorher = [
    { playerId: 1, roundId: 1, receivedLevel: 1 },
    { playerId: 2, roundId: 2, receivedLevel: 1 },
    { playerId: 3, roundId: 3, receivedLevel: 1 },
  ];

  const { zuordnungen, ringe } = tauschrunde(spieler, vorher);

  assert.equal(ringe.length, 1);
  assert.equal(ringe[0].personen.length, 3);
  for (const z of zuordnungen) {
    assert.equal(z.receivedLevel, 3, `Person ${z.playerId} sitzt nicht auf ihrem Wunsch`);
  }
});

test("ein einfacher Zweiertausch wird gefunden", () => {
  const spieler = [
    person(1, "A", { 1: 0, 2: 3 }),
    person(2, "B", { 2: 0, 1: 3 }),
  ];
  const vorher = [
    { playerId: 1, roundId: 1, receivedLevel: 0 },
    { playerId: 2, roundId: 2, receivedLevel: 0 },
  ];
  const { zuordnungen } = tauschrunde(spieler, vorher);
  assert.deepEqual(
    zuordnungen.map((z) => [z.playerId, z.roundId]),
    [
      [1, 2],
      [2, 1],
    ],
  );
});

test("niemand wird durch einen Tausch schlechter, die Belegung bleibt gleich", () => {
  const r = runden(2, 2, 2);
  const spieler = [
    person(1, "A", { 1: 1, 2: 3, 3: 0 }),
    person(2, "B", { 2: 1, 3: 3, 1: 0 }),
    person(3, "C", { 3: 1, 1: 3, 2: 0 }),
    person(4, "D", { 1: 2, 2: 2, 3: 2 }),
    person(5, "E", { 1: 3, 2: 0, 3: 0 }),
    person(6, "F", { 2: 3, 1: 0, 3: 0 }),
  ];
  const vorher = [
    { playerId: 1, roundId: 1, receivedLevel: 1 },
    { playerId: 2, roundId: 2, receivedLevel: 1 },
    { playerId: 3, roundId: 3, receivedLevel: 1 },
    { playerId: 4, roundId: 1, receivedLevel: 2 },
    { playerId: 5, roundId: 2, receivedLevel: 0 },
    { playerId: 6, roundId: 3, receivedLevel: 0 },
  ];

  const { zuordnungen } = tauschrunde(spieler, vorher);

  const vorLevel = new Map(vorher.map((z) => [z.playerId, z.receivedLevel]));
  for (const z of zuordnungen) {
    assert.ok(z.receivedLevel >= vorLevel.get(z.playerId), `Person ${z.playerId} wurde schlechter`);
  }
  assert.deepEqual([...belegung(zuordnungen)].sort(), [...belegung(vorher)].sort());
  assert.equal(r.length, 3); // Runden werden nicht angefasst
});

test("nach einer frischen RSD-Auslosung gibt es nichts zu tauschen", () => {
  // Das ist die Bestaetigung, nicht ein Mangel: RSD liefert bereits ein
  // Ergebnis, das sich nicht verbessern laesst, ohne jemanden schlechterzustellen.
  const r = runden(5, 5, 5);
  const s = Array.from({ length: 15 }, (_, i) =>
    person(i + 1, `P${i + 1}`, { 1: 3, 2: i % 3, 3: (i + 1) % 3 }),
  );
  for (let lauf = 0; lauf < 100; lauf++) {
    const { ringe } = tauschrunde(s, runMatching(r, s));
    assert.equal(ringe.length, 0, `Lauf ${lauf}: RSD war nicht verbesserungsfrei`);
  }
});

test("eine verkorkste Handkorrektur wird repariert", () => {
  // Genau der Anlass fuer den Schritt: der Wirt hat von Hand geschoben, ohne
  // alle Wuensche im Kopf zu haben, und dabei zwei Leute vertauscht.
  const spieler = [
    person(1, "A", { 1: 3, 2: 0 }),
    person(2, "B", { 2: 3, 1: 0 }),
  ];
  const verkorkst = [
    { playerId: 1, roundId: 2, receivedLevel: 0 },
    { playerId: 2, roundId: 1, receivedLevel: 0 },
  ];
  const { zuordnungen, ringe } = tauschrunde(spieler, verkorkst);
  assert.equal(ringe.length, 1);
  assert.deepEqual(
    zuordnungen.map((z) => [z.playerId, z.roundId, z.receivedLevel]),
    [
      [1, 1, 3],
      [2, 2, 3],
    ],
  );
});

test("wer ohne Platz ist, bleibt unberuehrt", () => {
  const spieler = [person(1, "A", { 1: 1, 2: 3 }), person(2, "B", { 1: 3, 2: 0 })];
  const vorher = [
    { playerId: 1, roundId: 1, receivedLevel: 1 },
    { playerId: 2, roundId: null, receivedLevel: null },
  ];
  const { zuordnungen, ringe } = tauschrunde(spieler, vorher);
  assert.equal(ringe.length, 0);
  assert.equal(zuordnungen[1].roundId, null);
});

test("leere Eingabe stuerzt nicht ab", () => {
  const { zuordnungen, ringe } = tauschrunde([], []);
  assert.deepEqual(zuordnungen, []);
  assert.deepEqual(ringe, []);
});

test("ein Gleichgueltiger blockiert den Ring nicht mehr", () => {
  // Am 30.08. in der Anwendung aufgefallen. Nora hatte jede Runde mit 😬
  // markiert; sie gewinnt also nie *strikt* und blockierte damit einen Ring, an
  // dem Ruben sehr wohl gewonnen haette. Sie umzusetzen kostet sie aber nach
  // ihrer eigenen Aussage nichts — dasselbe Argument, aus dem Gleichgueltige
  // zuletzt gezogen werden.
  const spieler = [
    person(1, "Ruben", { 1: 0, 2: 3 }), // sitzt falsch, will in 2
    person(2, "Nora", { 1: 0, 2: 0 }), // alles gleich schlecht
  ];
  const vorher = [
    { playerId: 1, roundId: 1, receivedLevel: 0 },
    { playerId: 2, roundId: 2, receivedLevel: 0 },
  ];

  const { zuordnungen, ringe } = tauschrunde(spieler, vorher);

  assert.equal(ringe.length, 1, "der Ring wurde nicht gefunden");
  const ruben = zuordnungen.find((z) => z.playerId === 1);
  const nora = zuordnungen.find((z) => z.playerId === 2);
  assert.equal(ruben.roundId, 2, "Ruben sitzt nicht auf seinem Wunsch");
  assert.equal(ruben.receivedLevel, 3);
  assert.equal(nora.roundId, 1, "Nora wurde nicht mitgezogen");
  assert.equal(nora.receivedLevel, 0, "Nora steht wie vorher da, nicht schlechter");
});

test("ein Ring ohne jede Verbesserung wird nicht vollzogen", () => {
  // Die Gegenprobe: zwei Gleichgueltige zu tauschen brachte niemandem etwas und
  // koennte endlos weiterlaufen.
  const spieler = [person(1, "A", { 1: 1, 2: 1 }), person(2, "B", { 1: 1, 2: 1 })];
  const vorher = [
    { playerId: 1, roundId: 1, receivedLevel: 1 },
    { playerId: 2, roundId: 2, receivedLevel: 1 },
  ];
  const { zuordnungen, ringe } = tauschrunde(spieler, vorher);
  assert.equal(ringe.length, 0);
  assert.deepEqual(
    zuordnungen.map((z) => z.roundId),
    [1, 2],
  );
});
