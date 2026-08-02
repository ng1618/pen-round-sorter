// Eingabepruefung der beiden offenen Routen. Aufruf: npm test
//
// Reine Funktionen, also ohne Server und ohne Datenbank pruefbar. Geprueft wird
// vor allem, was NICHT durchkommen darf — bis zum 02.08. landete ein
// 5000-Zeichen-Name ungeprueft in der Datenbank, und eine verletzte
// Datenbankbedingung wurde zu einem 500 statt einem lesbaren 400.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NAME,
  MAX_RUNDEN,
  pruefeEinreichung,
  pruefeRunde,
  pruefeRundenFelder,
} from "../src/lib/eingabe.ts";

const RUNDEN = [1, 2, 3];

test("gueltige Runde kommt durch und wird getrimmt", () => {
  const r = pruefeRunde({ dmName: "  Mara ", title: " Turm ", vibe: "", capacity: 5 }, 0);
  assert.ok(r.ok);
  assert.deepEqual(r.wert, { dmName: "Mara", title: "Turm", vibe: "", capacity: 5 });
});

test("Runde: zu langer Name, leerer Titel, unsinnige Platzzahl", () => {
  for (const [was, rumpf] of [
    ["langer Name", { dmName: "A".repeat(MAX_NAME + 1), title: "T", capacity: 5 }],
    ["leerer Titel", { dmName: "Mara", title: "   ", capacity: 5 }],
    ["Platzzahl 0", { dmName: "Mara", title: "T", capacity: 0 }],
    ["Platzzahl 99", { dmName: "Mara", title: "T", capacity: 99 }],
    ["Platzzahl als Text", { dmName: "Mara", title: "T", capacity: "fünf" }],
    ["Platzzahl mit Komma", { dmName: "Mara", title: "T", capacity: 4.5 }],
    ["gar kein Objekt", "kaputt"],
  ]) {
    assert.equal(pruefeRunde(rumpf, 0).ok, false, was);
  }
});

test("Runde: Obergrenze greift", () => {
  const r = pruefeRunde({ dmName: "Mara", title: "T", capacity: 5 }, MAX_RUNDEN);
  assert.equal(r.ok, false);
});

test("Bearbeiten: dieselben Feldpruefungen, aber ohne die Obergrenze", () => {
  // Die Obergrenze zaehlt Runden, die dazukommen — beim Bearbeiten kommt keine
  // dazu. Liefe das Bearbeiten ueber `pruefeRunde`, waere die zwanzigste Runde
  // nicht mehr aenderbar, ohne dass jemand den Zusammenhang erraet.
  const r = pruefeRundenFelder({ dmName: " Mara ", title: " Turm ", vibe: "", capacity: 7 });
  assert.ok(r.ok);
  assert.deepEqual(r.wert, { dmName: "Mara", title: "Turm", vibe: "", capacity: 7 });

  // Die Feldpruefungen selbst muessen aber identisch bleiben.
  assert.equal(pruefeRundenFelder({ dmName: "Mara", title: "   ", capacity: 5 }).ok, false);
  assert.equal(pruefeRundenFelder({ dmName: "Mara", title: "T", capacity: 0 }).ok, false);
});

test("Einreichung: nur der Name genuegt", () => {
  // "Mir ist alles recht" — der Fall, der bis zum 31.07. faelschlich als
  // "nichts davon" galt.
  const e = pruefeEinreichung({ playerName: "Sarah" }, RUNDEN, 0);
  assert.ok(e.ok);
  assert.deepEqual(e.wert.preferences, []);
});

test("Einreichung: gueltige Wuensche kommen durch", () => {
  const e = pruefeEinreichung(
    { playerName: "Sarah", preferences: [{ roundId: 1, level: 3 }, { roundId: 2, level: 0 }] },
    RUNDEN,
    0,
  );
  assert.ok(e.ok);
  assert.equal(e.wert.preferences.length, 2);
});

test("Einreichung: zwei Topwuensche werden abgelehnt", () => {
  // Sonst schlaegt der partielle Index zu und der Gast bekommt einen 500.
  const e = pruefeEinreichung(
    { playerName: "Sarah", preferences: [{ roundId: 1, level: 3 }, { roundId: 2, level: 3 }] },
    RUNDEN,
    0,
  );
  assert.equal(e.ok, false);
  assert.match(e.fehler, /unbedingt/);
});

test("Einreichung: unbekannte Runde, doppelte Runde, falsches Level", () => {
  for (const [was, prefs] of [
    ["unbekannte Runde", [{ roundId: 999, level: 1 }]],
    ["Runde doppelt", [{ roundId: 1, level: 1 }, { roundId: 1, level: 2 }]],
    ["Level 7", [{ roundId: 1, level: 7 }]],
    ["Level als Text", [{ roundId: 1, level: "hoch" }]],
    ["Wunsch kein Objekt", ["kaputt"]],
  ]) {
    const e = pruefeEinreichung({ playerName: "Sarah", preferences: prefs }, RUNDEN, 0);
    assert.equal(e.ok, false, was);
  }
});

test("Einreichung: Wuensche muessen eine Liste sein", () => {
  assert.equal(pruefeEinreichung({ playerName: "S", preferences: "viele" }, RUNDEN, 0).ok, false);
});

test("Einreichung: 5000-Zeichen-Name kommt nicht mehr durch", () => {
  const e = pruefeEinreichung({ playerName: "A".repeat(5000) }, RUNDEN, 0);
  assert.equal(e.ok, false);
  assert.match(e.fehler, /zu lang/);
});
