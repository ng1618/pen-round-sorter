// Der Zuweisungslöser. Aufruf: npm test
//
// Hier wird ausnahmsweise gegen erwartete Ergebnisse geprüft und nicht gegen
// Invarianten: die Ungarische Methode ist deterministisch, und kleine Fälle kann
// man von Hand nachrechnen. Genau das ist der Punkt — ein exakter Löser, dem man
// beim Rechnen zusehen kann, bevor er über echte Wünsche entscheidet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { kostenSumme, ungarisch } from "../src/lib/ungarisch.ts";

test("triviale 1x1-Zuordnung", () => {
  assert.deepEqual(ungarisch([[5]]), [0]);
});

test("2x2: die teure Diagonale wird gemieden", () => {
  // Diagonale kostet 10+10=20, die Kreuzung 1+1=2.
  const kosten = [
    [10, 1],
    [1, 10],
  ];
  const z = ungarisch(kosten);
  assert.deepEqual(z, [1, 0]);
  assert.equal(kostenSumme(kosten, z), 2);
});

test("3x3: von Hand nachgerechnet", () => {
  // Beste Zuordnung ist 0->1, 1->0, 2->2 mit 2+3+3 = 8.
  const kosten = [
    [4, 2, 8],
    [3, 9, 5],
    [8, 4, 3],
  ];
  const z = ungarisch(kosten);
  assert.equal(kostenSumme(kosten, z), 8);
  // Jede Spalte höchstens einmal.
  assert.equal(new Set(z).size, 3);
});

test("mehr Spalten als Zeilen: die teuren bleiben leer", () => {
  const kosten = [
    [1, 100, 100],
    [100, 1, 100],
  ];
  const z = ungarisch(kosten);
  assert.equal(kostenSumme(kosten, z), 2);
  assert.equal(z.length, 2);
});

test("weniger Spalten als Zeilen wird abgelehnt statt still falsch zu rechnen", () => {
  // Der Aufrufer muss mit Scheinplaetzen auffuellen. Stillschweigend jemanden
  // wegzulassen waere hier die schlechtere Variante.
  assert.throws(() => ungarisch([[1], [1]]), /Spalten/);
});

test("leere Eingabe ergibt leere Ausgabe", () => {
  assert.deepEqual(ungarisch([]), []);
});

test("gegen roheGewalt geprueft: 6x6 zufaellig, 200 Faelle", () => {
  // Der eigentliche Beweis: bei sechs Zeilen kann man alle 720 Zuordnungen
  // durchprobieren und mit dem Loeser vergleichen.
  const alle = (rest, gewaehlt = []) =>
    rest.length === 0
      ? [gewaehlt]
      : rest.flatMap((s, i) => alle([...rest.slice(0, i), ...rest.slice(i + 1)], [...gewaehlt, s]));

  const spalten = [0, 1, 2, 3, 4, 5];
  for (let lauf = 0; lauf < 200; lauf++) {
    const kosten = Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, () => Math.floor(Math.random() * 50)),
    );
    const bestes = Math.min(
      ...alle(spalten).map((p) => p.reduce((s, spalte, zeile) => s + kosten[zeile][spalte], 0)),
    );
    assert.equal(kostenSumme(kosten, ungarisch(kosten)), bestes, `Lauf ${lauf}`);
  }
});
