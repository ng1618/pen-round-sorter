// Absicherung fuer den Eventabend (20.11.). Aufruf: npm test
//
// Gast-Passwort, Sperre ab dem Auslosen, Korrektur behaelt das Verfahren,
// Protokollzeit des festgelegten Laufs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { korrekturKonfiguration } from "../src/lib/auslosung-pruefen.ts";
import { gastWert, gastWertGueltig, rundenAenderungPruefen } from "../src/lib/abend.ts";
import { protokollText } from "../src/lib/protokoll.ts";

// --- Korrektur behaelt die Konfiguration des festgelegten Laufs ---

test("Korrektur eines Leximin-Laufs bleibt Leximin", () => {
  const k = korrekturKonfiguration({ verfahren: "leximin", reihenfolge: "gleichstand", ausgleichUeberTage: false });
  assert.equal(k.verfahren, "leximin");
  assert.equal(k.ausgleichUeberTage, false);
  assert.equal(k.grundlage, "letzter Lauf");
  assert.equal(k.reihenfolge, "uebernommen");
});

test("Korrektur uebernimmt fruehere Aufstockungen, nicht die alte Handarbeit", () => {
  const k = korrekturKonfiguration({
    verfahren: "rsd",
    plaetzeNachtraeglich: [{ titel: "A", von: 5, auf: 6 }],
    manuellKorrigiert: true,
    tauschrunden: 2,
  });
  assert.deepEqual(k.plaetzeNachtraeglich, [{ titel: "A", von: 5, auf: 6 }]);
  // Sonst fragte "Neu auslosen" in einer frischen Korrektur nach, obwohl darin
  // noch nichts von Hand geaendert wurde.
  assert.equal(k.manuellKorrigiert, undefined);
  assert.equal(k.tauschrunden, undefined);
});

test("Korrektur ohne Verfahren im alten Lauf faellt auf rsd", () => {
  assert.equal(korrekturKonfiguration({}).verfahren, "rsd");
});

// --- Protokollzeit ---

test("Protokoll nimmt die uebergebene Zeit, in deutscher Zeit", () => {
  const a = {
    seed: "",
    konfiguration: { verfahren: "rsd" },
    eingabestand: { runden: [], spieler: [] },
    losreihenfolge: [],
    zuordnungen: [],
  };
  // 18:30 UTC ist im November 19:30 in Berlin — auch auf einem Server in UTC.
  const t = protokollText(a, new Date("2026-11-20T18:30:00.000Z"));
  assert.match(t.split("\n")[0], /20\.11\.2026, 19:30/);
});

// --- Runden nach dem Auslosen ---

const alt = { dmName: "Mara", title: "Krypta", vibe: "duester", capacity: 5 };

test("vor dem Auslosen ist jede Aenderung erlaubt", () => {
  assert.equal(rundenAenderungPruefen(alt, { ...alt, title: "Neu", capacity: 3 }, false), null);
});

test("nach dem Auslosen: nur mehr Plaetze, sonst nichts", () => {
  assert.equal(rundenAenderungPruefen(alt, { ...alt, capacity: 6 }, true), null);
  assert.equal(rundenAenderungPruefen(alt, { ...alt }, true), null);
  assert.match(rundenAenderungPruefen(alt, { ...alt, capacity: 4 }, true), /nur erhöhen/);
  assert.match(rundenAenderungPruefen(alt, { ...alt, title: "Andere" }, true), /gesperrt/);
  assert.match(rundenAenderungPruefen(alt, { ...alt, dmName: "Nils" }, true), /gesperrt/);
  assert.match(rundenAenderungPruefen(alt, { ...alt, vibe: "" }, true), /gesperrt/);
});

// --- Gast-Passwort ---

test("Gast-Cookie gilt nur fuer das Passwort, aus dem es entstand", () => {
  const wert = gastWert("roter-drache");
  assert.equal(gastWertGueltig(wert, "roter-drache"), true);
  assert.equal(gastWertGueltig(wert, "blauer-drache"), false);
  assert.equal(gastWertGueltig(undefined, "roter-drache"), false);
  assert.equal(gastWertGueltig("", "roter-drache"), false);
  assert.equal(gastWertGueltig("kurz", "roter-drache"), false);
});

test("Gast-Cookie ist nicht das Passwort im Klartext", () => {
  assert.doesNotMatch(gastWert("roter-drache"), /drache/);
});

test("kurze Gast-Passwoerter sind erlaubt (keine Mindestlaenge)", () => {
  assert.equal(gastWertGueltig(gastWert("x"), "x"), true);
});
