// Die Adresse, die in die QR-Codes eingebrannt wird. Aufruf: npm test
//
// Warum ausgerechnet das geprueft wird: ein gedruckter QR-Code friert eine URL
// ein. Ist sie falsch, faellt es nicht beim Drucken auf, sondern am Eventabend
// vor achtzehn Leuten. Die beiden Faelle, die dabei schiefgehen koennen, sind
// "hinter dem Proxy die interne Adresse genommen" und "aus Versehen von
// localhost gedruckt".

import { test } from "node:test";
import assert from "node:assert/strict";
import { basisUrl } from "../src/lib/basis-url.ts";

/** Baut eine Kopfzeilen-Funktion aus einem Objekt. */
function kopf(werte) {
  return (name) => werte[name] ?? null;
}

test("hinter dem Proxy zaehlt x-forwarded-*, nicht host", () => {
  // Auf Railway ist `host` die interne Adresse. Wer die nimmt, druckt einen
  // Code, den kein Handy erreicht.
  const b = basisUrl(
    kopf({
      host: "pen-round-sorter.railway.internal:8080",
      "x-forwarded-host": "pen-round-sorter-production.up.railway.app",
      "x-forwarded-proto": "https",
    }),
  );
  assert.equal(b.url, "https://pen-round-sorter-production.up.railway.app");
  assert.equal(b.erreichbarkeit, "oeffentlich");
});

test("ohne Proxy genuegt host", () => {
  const b = basisUrl(kopf({ host: "runden.example.de", "x-forwarded-proto": "https" }));
  assert.equal(b.url, "https://runden.example.de");
  assert.equal(b.erreichbarkeit, "oeffentlich");
});

test("drei Stufen: nur dieser Rechner, Heimnetz, oeffentlich", () => {
  // Die Unterscheidung traegt eine Aussage: das Heimnetz ist hier ein
  // regulaerer Betriebsmodus (Laptop-Notausgang), kein Fehler. Zwei Stufen
  // wuerden die Heimnetz-Probe faelschlich als kaputt ausweisen.
  for (const host of ["localhost:3000", "127.0.0.1:3000", "0.0.0.0:3000"]) {
    assert.equal(basisUrl(kopf({ host })).erreichbarkeit, "nur-dieser-rechner", host);
  }
  for (const host of ["192.168.1.42:3000", "10.0.0.5", "laptop.local"]) {
    assert.equal(basisUrl(kopf({ host })).erreichbarkeit, "heimnetz", host);
  }
  // 172.16–172.31 ist privat, 172.32 nicht mehr — die Grenze ist leicht zu
  // verwechseln, deshalb beide Seiten davon.
  assert.equal(basisUrl(kopf({ host: "172.20.0.1" })).erreichbarkeit, "heimnetz");
  assert.equal(basisUrl(kopf({ host: "172.32.0.1" })).erreichbarkeit, "oeffentlich");
});

test("localhost bekommt http, alles andere https", () => {
  assert.equal(basisUrl(kopf({ host: "localhost:3000" })).url, "http://localhost:3000");
  assert.equal(basisUrl(kopf({ host: "runden.example.de" })).url, "https://runden.example.de");
});

test("PRS_BASIS_URL schlaegt die Kopfzeilen", () => {
  const b = basisUrl(kopf({ host: "localhost:3000" }), "https://runden.example.de");
  assert.equal(b.url, "https://runden.example.de");
  assert.equal(b.erreichbarkeit, "oeffentlich");
});

test("PRS_BASIS_URL: Schraegstrich am Ende faellt weg", () => {
  // Sonst entstuende `https://…//rank`, was zwar meist funktioniert, aber im
  // Klartext unter dem Code schlampig aussieht.
  assert.equal(basisUrl(kopf({}), "https://runden.example.de/").url, "https://runden.example.de");
});

test("leere PRS_BASIS_URL wird ignoriert statt uebernommen", () => {
  assert.equal(basisUrl(kopf({ host: "runden.example.de" }), "   ").url, "https://runden.example.de");
});

test("PRS_BASIS_URL auf localhost wird trotzdem eingestuft", () => {
  assert.equal(basisUrl(kopf({}), "http://localhost:3000").erreichbarkeit, "nur-dieser-rechner");
});
