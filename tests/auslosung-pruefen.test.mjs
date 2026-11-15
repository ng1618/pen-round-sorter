// Die Schranke vor dem Festlegen. Aufruf: npm test
//
// Seit dem 30.08. die **einzige** Schranke gegen Überbelegung: die Oberfläche
// lässt Umsetzen jetzt auch in volle Runden zu und sperrt nur das Festlegen.
// Fällt diese Funktion aus, entstünde eine gespeicherte Auslosung, die sechs
// Leute an einen Tisch mit fünf Plätzen setzt — und Läufe sind unveränderlich.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeAuslosung, standAbgleich, vorschauVeraendert } from "../src/lib/auslosung-pruefen.ts";

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

// ---------------------------------------------------------------------------
// Abgleich mit dem Live-Stand vor dem Festlegen (E2E-Fund vom 15.11.).
//
// Bis dahin verglich `commit` nur die ANZAHL. Entfernt man nach dem Auslosen
// die zuletzt eingereichte Person und reicht jemand Neues ein, bleibt die Zahl
// gleich — und SQLite vergibt die frei gewordene Id neu. Der Lauf trug dann im
// Schnappschuss die alte Person, in der Zuordnung die neue, die nie mitgelost
// wurde. War die Id nicht die letzte, scheiterte das Festlegen mit einem 500.

const benannt = (id, playerName) => ({ ...person(id), playerName });

test("unveraenderter Stand ist gleich", () => {
  const r = standAbgleich({ runden: [runde(1, 5)], spieler: [person(1), person(2)] }, [runde(1, 5)], [person(1), person(2)]);
  assert.equal(r.art, "gleich");
});

test("dieselbe Id mit anderem Namen ist ersetzt, nicht gleich", () => {
  const r = standAbgleich(
    { runden: [runde(1, 5)], spieler: [benannt(1, "Anna"), benannt(2, "Wegwerf")] },
    [runde(1, 5)],
    [benannt(1, "Anna"), benannt(2, "Spaet")],
  );
  assert.equal(r.art, "fehlt");
  assert.deepEqual(r.namen, ["Wegwerf"]);
});

test("Gross-/Kleinschreibung und Leerzeichen im Namen sind keine Ersetzung", () => {
  // Der Upsert darf "Sarah" durch "SARAH " ersetzen — gleiche Person, gleiche Id.
  const r = standAbgleich(
    { runden: [runde(1, 5)], spieler: [benannt(1, "Sarah")] },
    [runde(1, 5)],
    [benannt(1, "SARAH ")],
  );
  assert.equal(r.art, "gleich");
});

test("entfernte Person fehlt, auch wenn die Anzahl gleich bleibt", () => {
  const r = standAbgleich(
    { runden: [runde(1, 5)], spieler: [benannt(1, "Anna"), benannt(2, "Ben")] },
    [runde(1, 5)],
    [benannt(1, "Anna"), benannt(3, "Cleo")],
  );
  assert.equal(r.art, "fehlt");
  assert.deepEqual(r.namen, ["Ben"]);
});

test("verschwundene Runde fehlt", () => {
  const r = standAbgleich({ runden: [runde(1, 5), runde(2, 5)], spieler: [person(1)] }, [runde(1, 5)], [person(1)]);
  assert.equal(r.art, "fehlt");
});

test("nur Dazugekommene sind 'dazu' — die bisherige Rueckfrage", () => {
  const r = standAbgleich(
    { runden: [runde(1, 5)], spieler: [benannt(1, "Anna")] },
    [runde(1, 5), runde(2, 5)],
    [benannt(1, "Anna"), benannt(2, "Nachzuegler")],
  );
  assert.equal(r.art, "dazu");
  assert.deepEqual(r.namen, ["Nachzuegler"]);
  assert.equal(r.runden, 1);
});

// --- vorschauVeraendert: Rueckfrage vor „Neu auslosen" ---------------------
// Ein neuer Wurf ersetzt die Vorschau. Ist sie frisch, geht nichts verloren;
// wurde von Hand umgesetzt, getauscht oder aufgestockt, schon.

test("frische Vorschau gilt als unveraendert", () => {
  assert.equal(vorschauVeraendert({ verfahren: "rsd", reihenfolge: "wunsch-zuerst" }), false);
});

test("Handkorrektur, Ringtausch oder Aufstocken gelten als Veraenderung", () => {
  assert.equal(vorschauVeraendert({ manuellKorrigiert: true }), true);
  assert.equal(vorschauVeraendert({ tauschrunden: 2 }), true);
  assert.equal(vorschauVeraendert({ plaetzeNachtraeglich: [{ titel: "A", von: 5, auf: 6 }] }), true);
});

test("leere oder genullte Angaben gelten nicht als Veraenderung", () => {
  assert.equal(vorschauVeraendert({ manuellKorrigiert: false, tauschrunden: 0, plaetzeNachtraeglich: [] }), false);
});
