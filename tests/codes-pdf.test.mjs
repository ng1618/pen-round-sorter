// QR-Codes als PDF (20.11.). Aufruf: npm test
//
// Von Hand geschriebenes PDF ohne Bibliothek — deshalb wird hier die Struktur
// geprueft, an der Leseprogramme sonst scheitern: Querverweistabelle mit
// stimmenden Byte-Positionen, eine Seite je Code, Umlaute in WinAnsi.

import { test } from "node:test";
import assert from "node:assert/strict";
import { codesPdf, winAnsiHex } from "../src/lib/codes-pdf.ts";

const seite = (titel) => ({
  titel,
  hinweis: "Hier sagst du, worauf du Lust hast. Dauert eine Minute — wer nichts abgibt, wird trotzdem gesetzt.",
  url: "https://beispiel.up.railway.app/rank",
});

test("PDF hat Kopf, Ende und eine Seite je Code", () => {
  const pdf = Buffer.from(codesPdf([seite("Für die Spielleitungen"), seite("Für die Spielenden")]));
  const text = pdf.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.equal((text.match(/\/Type \/Page\b/g) ?? []).length, 2);
  assert.match(text, /\/Count 2/);
});

test("Querverweise zeigen auf die richtigen Byte-Positionen", () => {
  const pdf = Buffer.from(codesPdf([seite("A"), seite("B")]));
  const text = pdf.toString("latin1");
  const start = Number(text.match(/startxref\s+(\d+)/)[1]);
  assert.ok(text.slice(start).startsWith("xref"));
  const eintraege = text.slice(start).split("\n").slice(3).filter((z) => /^\d{10} 00000 n/.test(z));
  eintraege.forEach((z, i) => {
    const pos = Number(z.slice(0, 10));
    assert.ok(text.slice(pos).startsWith(`${i + 1} 0 obj`), `Objekt ${i + 1} nicht bei ${pos}`);
  });
});

test("Umlaute und Gedankenstrich in WinAnsi", () => {
  assert.equal(winAnsiHex("Für"), "46FC72");
  assert.equal(winAnsiHex("—"), "97");
  assert.equal(winAnsiHex("„x“"), "847893");
  // Unbekanntes wird zum Fragezeichen statt das PDF zu zerbrechen.
  assert.equal(winAnsiHex("🎲"), "3F");
});
