// Ratenbegrenzung und Mindestlaenge beim Anmelden. Aufruf: npm test
//
// Seit dem 14.11. ist Railway der Hauptweg und die Anmeldung aus dem ganzen
// Netz erreichbar. Im Sicherheitsdurchgang vom 01.08. waren acht Fehlversuche
// in Folge ohne jede Verzoegerung belegt.

import { test } from "node:test";
import assert from "node:assert/strict";
import { neueBremse, passwortZuKurz, PASSWORT_MINDESTLAENGE } from "../src/lib/anmeldung.ts";

test("Mindestlaenge ist 8", () => {
  assert.equal(PASSWORT_MINDESTLAENGE, 8);
  assert.equal(passwortZuKurz("1234567"), true);
  assert.equal(passwortZuKurz("12345678"), false);
});

test("Leerzeichen zaehlen als Zeichen", () => {
  // Bewusst kein trim(): das Passwort wird so gehasht, wie es getippt wurde.
  assert.equal(passwortZuKurz("        "), false);
});

test("vier Fehlversuche sperren noch nicht", () => {
  const b = neueBremse();
  for (let i = 0; i < 4; i++) b.fehlschlag(1000);
  assert.equal(b.wartenMs(1000), 0);
});

test("der fuenfte Fehlversuch sperrt fuer 60 Sekunden", () => {
  const b = neueBremse();
  for (let i = 0; i < 5; i++) b.fehlschlag(1000);
  assert.equal(b.wartenMs(1000), 60_000);
  assert.equal(b.wartenMs(31_000), 30_000);
  assert.equal(b.wartenMs(61_000), 0);
});

test("nach Ablauf der Sperre beginnt die Zaehlung von vorn", () => {
  const b = neueBremse();
  for (let i = 0; i < 5; i++) b.fehlschlag(0);
  b.fehlschlag(60_000);
  assert.equal(b.wartenMs(60_000), 0, "ein Fehlversuch nach der Sperre sperrt nicht sofort wieder");
  for (let i = 0; i < 4; i++) b.fehlschlag(60_000);
  assert.equal(b.wartenMs(60_000), 60_000);
});

test("eine erfolgreiche Anmeldung setzt die Zaehlung zurueck", () => {
  const b = neueBremse();
  for (let i = 0; i < 4; i++) b.fehlschlag(0);
  b.erfolg();
  for (let i = 0; i < 4; i++) b.fehlschlag(0);
  assert.equal(b.wartenMs(0), 0);
});

test("Versuche und Sperrdauer lassen sich einstellen", () => {
  const b = neueBremse({ versuche: 2, sperreMs: 10 });
  b.fehlschlag(0);
  b.fehlschlag(0);
  assert.equal(b.wartenMs(0), 10);
});

test("ein Erfolg hebt auch eine laufende Sperre auf", () => {
  // Die Route zaehlt jeden Versuch vorab als Fehlversuch. Ist der fuenfte der
  // richtige, sperrt er erst und nimmt es mit dem Erfolg zurueck.
  const b = neueBremse();
  for (let i = 0; i < 5; i++) b.fehlschlag(0);
  b.erfolg();
  assert.equal(b.wartenMs(0), 0);
});
