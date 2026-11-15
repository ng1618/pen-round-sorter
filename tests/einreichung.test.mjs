// Mehrfach-Alarm: wann gilt eine erneute Einreichung als geaendert? Aufruf: npm test
//
// Zweimal dasselbe Ranking (Netz gewackelt, doppelt getippt) darf NICHT
// auffallen — sonst lernt die Verwaltung am ersten Abend, den Hinweis zu
// ueberlesen. Gezaehlt wird nur, was sich wirklich unterscheidet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { rankingGeaendert } from "../src/lib/einreichung.ts";

test("gleiches Ranking ist keine Aenderung", () => {
  const r = [
    { roundId: 1, level: 3 },
    { roundId: 2, level: 0 },
  ];
  assert.equal(rankingGeaendert(r, [...r]), false);
});

test("Reihenfolge der Eintraege spielt keine Rolle", () => {
  assert.equal(
    rankingGeaendert(
      [
        { roundId: 1, level: 3 },
        { roundId: 2, level: 0 },
      ],
      [
        { roundId: 2, level: 0 },
        { roundId: 1, level: 3 },
      ],
    ),
    false,
  );
});

test("andere Stufe fuer dieselbe Runde ist eine Aenderung", () => {
  assert.equal(
    rankingGeaendert([{ roundId: 1, level: 3 }], [{ roundId: 1, level: 2 }]),
    true,
  );
});

test("Topwunsch auf eine andere Runde ist eine Aenderung", () => {
  assert.equal(
    rankingGeaendert([{ roundId: 1, level: 3 }], [{ roundId: 2, level: 3 }]),
    true,
  );
});

test("ausdruecklich 'geht auch' gilt wie nicht angegeben", () => {
  // Gespeichert wird 'geht auch' gar nicht — der alte Stand aus der Datenbank
  // kennt die Zeile also nie, der neue aus dem Formular vielleicht schon.
  assert.equal(
    rankingGeaendert(
      [{ roundId: 1, level: 3 }],
      [
        { roundId: 1, level: 3 },
        { roundId: 2, level: 1 },
      ],
    ),
    false,
  );
});

test("nur Name gegen nur Name ist keine Aenderung", () => {
  assert.equal(rankingGeaendert([], []), false);
});

test("nur Name gegen ein Ranking ist eine Aenderung", () => {
  assert.equal(rankingGeaendert([], [{ roundId: 1, level: 3 }]), true);
});
