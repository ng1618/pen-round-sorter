// Die beiden Texte, die den Papier-Notausgang tragen. Aufruf: npm test
//
// Geprueft wird, dass die Angaben drinstehen, die man braucht, um von Hand
// auszulosen bzw. das Ergebnis auszuhaengen — nicht die genaue Formatierung.

import { test } from "node:test";
import assert from "node:assert/strict";
import { einreichungenText, protokollText } from "../src/lib/protokoll.ts";

const RUNDEN = [
  { id: 1, dmName: "Mara", title: "Turm", vibe: "", capacity: 5, createdAt: 0 },
  { id: 2, dmName: "Nils", title: "Sumpf", vibe: "", capacity: 5, createdAt: 0 },
];

const SPIELER = [
  {
    id: 1,
    playerName: "Sarah",
    preferences: [{ roundId: 1, level: 3 }],
    submittedAt: 1,
    createdAt: 0,
  },
  { id: 2, playerName: "Paul", preferences: [], submittedAt: null, createdAt: 0 },
];

test("Einreichungen: Wuensche, Runden und Nicht-Einreichende stehen drin", () => {
  const t = einreichungenText(RUNDEN, SPIELER);
  assert.match(t, /Sarah/);
  assert.match(t, /Turm/);
  // Der Fall, den man beim Auslosen von Hand am ehesten falsch macht.
  assert.match(t, /Paul — nichts eingereicht \(gilt als: alles geht auch\)/);
  assert.match(t, /Beliebtheit je Runde/);
});

test("Einreichungen: Unterdeckung wird gewarnt", () => {
  const viele = Array.from({ length: 12 }, (_, i) => ({
    id: i + 10,
    playerName: `P${i}`,
    preferences: [],
    submittedAt: 1,
    createdAt: 0,
  }));
  assert.match(einreichungenText(RUNDEN, viele), /ACHTUNG Unterdeckung: 2 /);
});

test("Protokoll: Ergebnis, Kennzahlen und Losreihenfolge stehen drin", () => {
  const a = {
    seed: "",
    konfiguration: { verfahren: "rsd" },
    eingabestand: { runden: RUNDEN, spieler: SPIELER },
    losreihenfolge: [1, 2],
    zuordnungen: [
      { playerId: 1, roundId: 1, receivedLevel: 3 },
      { playerId: 2, roundId: 2, receivedLevel: 1 },
    ],
  };
  const t = protokollText(a);
  assert.match(t, /Turm — Leitung Mara \(1\/5\)/);
  assert.match(t, /- Sarah/);
  assert.match(t, /Losreihenfolge/);
  // Solange kein Seed existiert, soll das Protokoll das selbst sagen, statt
  // Reproduzierbarkeit zu suggerieren.
  assert.match(t, /nicht reproduzierbar/);
});

test("Protokoll: die geltende Losreihenfolge-Regel steht dabei", () => {
  // Ohne diesen Satz sieht die Reihenfolge willkuerlich aus, und die Frage
  // "warum kam der zuerst dran?" hat am Eventabend keine Antwort.
  const basis = {
    seed: "",
    eingabestand: { runden: RUNDEN, spieler: SPIELER },
    losreihenfolge: [1, 2],
    zuordnungen: [
      { playerId: 1, roundId: 1, receivedLevel: 3 },
      { playerId: 2, roundId: 2, receivedLevel: 1 },
    ],
  };

  assert.match(
    protokollText({ ...basis, konfiguration: { reihenfolge: "wunsch-zuerst" } }),
    /erst die mit einem Wunsch, dann die ohne/,
  );
  assert.match(
    protokollText({ ...basis, konfiguration: { reihenfolge: "einheitlich" } }),
    /rein zufaellig/,
  );
  assert.match(
    protokollText({ ...basis, konfiguration: { reihenfolge: "uebernommen" } }),
    /nicht neu gelost/,
  );

  // Ohne Angabe lieber gar keine Erklaerung als eine falsche.
  const ohne = protokollText({ ...basis, konfiguration: {} });
  assert.match(ohne, /Losreihenfolge/);
  assert.doesNotMatch(ohne, /erst die mit einem Wunsch|rein zufaellig|nicht neu gelost/);
});

test("Protokoll: wer ohne Platz bleibt, wird eigens ausgewiesen", () => {
  const a = {
    seed: "",
    konfiguration: {},
    eingabestand: { runden: RUNDEN, spieler: SPIELER },
    losreihenfolge: [1, 2],
    zuordnungen: [
      { playerId: 1, roundId: 1, receivedLevel: 3 },
      { playerId: 2, roundId: null, receivedLevel: null },
    ],
  };
  const t = protokollText(a);
  assert.match(t, /Ohne Platz \(1\)/);
  assert.match(t, /- Paul/);
});

test("Protokoll: nachtraeglich geaenderte Platzzahlen stehen drin", () => {
  // Wird waehrend der Auslosung aufgestockt ("ach komm, dann machen wir
  // sechs"), muss der Ausdruck das sagen — sonst liest er sich, als haette der
  // Tisch von Anfang an sechs Plaetze gehabt.
  const t = protokollText({
    seed: "",
    konfiguration: {
      verfahren: "rsd",
      plaetzeNachtraeglich: [{ titel: "Turm", von: 5, auf: 6 }],
    },
    eingabestand: { runden: RUNDEN, spieler: SPIELER },
    losreihenfolge: [1, 2],
    zuordnungen: [
      { playerId: 1, roundId: 1, receivedLevel: 3 },
      { playerId: 2, roundId: 2, receivedLevel: 1 },
    ],
  });
  assert.match(t, /nachtraeglich geaendert/);
  assert.match(t, /Turm: 5 -> 6/);
});

test("Protokoll: ohne Aenderung steht dazu nichts", () => {
  const t = protokollText({
    seed: "",
    konfiguration: { verfahren: "rsd" },
    eingabestand: { runden: RUNDEN, spieler: SPIELER },
    losreihenfolge: [1, 2],
    zuordnungen: [{ playerId: 1, roundId: 1, receivedLevel: 3 }],
  });
  assert.doesNotMatch(t, /nachtraeglich/);
});
