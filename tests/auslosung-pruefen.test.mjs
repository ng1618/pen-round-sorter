// Die Schranke vor dem Festlegen. Aufruf: npm test
//
// Seit dem 30.08. die **einzige** Schranke gegen Überbelegung: die Oberfläche
// lässt Umsetzen jetzt auch in volle Runden zu und sperrt nur das Festlegen.
// Fällt diese Funktion aus, entstünde eine gespeicherte Auslosung, die sechs
// Leute an einen Tisch mit fünf Plätzen setzt — und Läufe sind unveränderlich.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeAuslosung } from "../src/lib/auslosung-pruefen.ts";

const runde = (id, capacity) => ({
  id,
  dmName: `DM${id}`,
  title: `Runde ${id}`,
  vibe: "",
  capacity,
  createdAt: 0,
});

const person = (id, prefs = {}) => ({
  id,
  playerName: `P${id}`,
  preferences: Object.entries(prefs).map(([roundId, level]) => ({ roundId: Number(roundId), level })),
  submittedAt: 0,
  createdAt: 0,
});

const auslosung = (runden, spieler, zuordnungen) => ({
  seed: "",
  konfiguration: {},
  eingabestand: { runden, spieler },
  losreihenfolge: spieler.map((s) => s.id),
  zuordnungen,
});

test("eine stimmige Auslosung kommt durch", () => {
  const a = auslosung(
    [runde(1, 2)],
    [person(1, { 1: 3 }), person(2)],
    [
      { playerId: 1, roundId: 1, receivedLevel: 3 },
      { playerId: 2, roundId: 1, receivedLevel: 1 },
    ],
  );
  assert.equal(pruefeAuslosung(a), null);
});

test("Ueberbelegung wird abgelehnt", () => {
  // Der Fall, der seit dem 30.08. nur noch hier abgefangen wird.
  const a = auslosung(
    [runde(1, 1)],
    [person(1, { 1: 3 }), person(2, { 1: 3 })],
    [
      { playerId: 1, roundId: 1, receivedLevel: 3 },
      { playerId: 2, roundId: 1, receivedLevel: 3 },
    ],
  );
  assert.match(pruefeAuslosung(a), /ueberbelegt/);
});

test("genau volle Runde ist in Ordnung", () => {
  // Die Grenze selbst: 5 von 5 muss durchgehen, sonst waere die geplante
  // Aufstellung (15 auf 15) grundsaetzlich nicht festlegbar.
  const spieler = [1, 2, 3, 4, 5].map((i) => person(i, { 1: 1 }));
  const a = auslosung(
    [runde(1, 5)],
    spieler,
    spieler.map((s) => ({ playerId: s.id, roundId: 1, receivedLevel: 1 })),
  );
  assert.equal(pruefeAuslosung(a), null);
});

test("geschoenrechnetes Level wird abgelehnt", () => {
  // Sonst saehe eine Handkorrektur in der Statistik besser aus, als sie war.
  const a = auslosung(
    [runde(1, 2)],
    [person(1, { 1: 0 })],
    [{ playerId: 1, roundId: 1, receivedLevel: 3 }],
  );
  assert.match(pruefeAuslosung(a), /passt nicht zu ihrer Angabe/);
});

test("dieselbe Person zweimal wird abgelehnt", () => {
  const a = auslosung(
    [runde(1, 5)],
    [person(1, { 1: 1 })],
    [
      { playerId: 1, roundId: 1, receivedLevel: 1 },
      { playerId: 1, roundId: 1, receivedLevel: 1 },
    ],
  );
  assert.match(pruefeAuslosung(a), /doppelt/);
});

test("unbekannte Person und unbekannte Runde werden abgelehnt", () => {
  const r = [runde(1, 5)];
  const s = [person(1, { 1: 1 })];
  assert.match(
    pruefeAuslosung(auslosung(r, s, [{ playerId: 99, roundId: 1, receivedLevel: 1 }])),
    /Unbekannte Person/,
  );
  assert.match(
    pruefeAuslosung(auslosung(r, s, [{ playerId: 1, roundId: 99, receivedLevel: 1 }])),
    /Unbekannte Runde/,
  );
});

test("ohne Platz, aber mit Level wird abgelehnt", () => {
  const a = auslosung([runde(1, 5)], [person(1)], [{ playerId: 1, roundId: null, receivedLevel: 2 }]);
  assert.match(pruefeAuslosung(a), /ohne Platz, aber mit Level/);
});

test("ohne Platz und ohne Level ist in Ordnung", () => {
  const a = auslosung([runde(1, 0)], [person(1)], [{ playerId: 1, roundId: null, receivedLevel: null }]);
  assert.equal(pruefeAuslosung(a), null);
});

test("unvollstaendige Eingaben stuerzen nicht ab", () => {
  for (const kaputt of [undefined, {}, { eingabestand: {} }, { eingabestand: { runden: [], spieler: [] } }]) {
    assert.match(pruefeAuslosung(kaputt), /unvollstaendig/);
  }
});
