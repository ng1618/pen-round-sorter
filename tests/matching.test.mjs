// Invarianten des Matchers. Aufruf: npm test
//
// Warum Invarianten und keine erwarteten Ergebnisse: RSD ist zufaellig. Ein
// Test der Form "Sarah bekommt Runde 2" waere entweder falsch oder muesste den
// Zufall festnageln — und der ist bisher nicht saebar (`Math.random()` in
// `shuffled()`, steht auf der Liste). Also wird jeder Lauf gegen Aussagen
// geprueft, die IMMER gelten muessen, und das viele Male.
//
// Diese drei Aussagen stammen aus dem Testkatalog (Arbeitsdokument, Abschnitt
// 15) und sind bewusst unabhaengig von jedem spaeteren Feature: Gewichtung,
// gesaeter Zufall und Wochenend-Vorrang aendern sie nicht.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runMatching } from "../src/lib/matching.ts";

const LAEUFE = 200;

/** Drei Tische a `plaetze`. */
function runden(...plaetze) {
  return plaetze.map((p, i) => ({
    id: i + 1,
    dmName: `DM${i + 1}`,
    title: `Runde ${i + 1}`,
    vibe: "",
    capacity: p,
    createdAt: 0,
  }));
}

/**
 * `levels` ist ein Objekt {rundenId: level}. Was fehlt, gilt als "geht auch" —
 * genau wie in der Anwendung. `{}` heisst also "mir ist alles recht", nicht
 * "nichts davon".
 */
function spieler(anzahl, levels = () => ({})) {
  return Array.from({ length: anzahl }, (_, i) => ({
    id: i + 1,
    playerName: `P${i + 1}`,
    preferences: Object.entries(levels(i)).map(([roundId, level]) => ({
      roundId: Number(roundId),
      level,
    })),
    submittedAt: 0,
    createdAt: 0,
  }));
}

/** Fuehrt den Matcher `LAEUFE` mal aus und reicht jedes Ergebnis an `pruefen`. */
function vieleLaeufe(r, s, pruefen) {
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    pruefen(runMatching(r, s), lauf);
  }
}

test("keine Runde wird ueberbelegt", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, () => ({ 1: 3 })); // alle wollen unbedingt Runde 1
  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    const proRunde = new Map();
    for (const z of zuordnungen) {
      if (z.roundId == null) continue;
      proRunde.set(z.roundId, (proRunde.get(z.roundId) ?? 0) + 1);
    }
    for (const runde of r) {
      const belegt = proRunde.get(runde.id) ?? 0;
      assert.ok(
        belegt <= runde.capacity,
        `Lauf ${lauf}: Runde ${runde.id} mit ${belegt} von ${runde.capacity} Plaetzen belegt`,
      );
    }
  });
});

test("jede Person kommt genau einmal vor", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, (i) => ({ [(i % 3) + 1]: 3 }));
  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    assert.equal(zuordnungen.length, s.length, `Lauf ${lauf}: falsche Anzahl`);
    const ids = new Set(zuordnungen.map((z) => z.playerId));
    assert.equal(ids.size, s.length, `Lauf ${lauf}: jemand doppelt oder gar nicht`);
  });
});

test("niemand bleibt uebrig, solange Plaetze da sind", () => {
  const r = runden(5, 5, 5); // 15 Plaetze
  const s = spieler(15); // 15 Personen, alle ohne jede Angabe
  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    const ohne = zuordnungen.filter((z) => z.roundId == null);
    assert.equal(
      ohne.length,
      0,
      `Lauf ${lauf}: ${ohne.length} ohne Platz, obwohl 15 Plaetze fuer 15 Personen da sind`,
    );
  });
});

test("wer nur seinen Namen abschickt, bekommt trotzdem einen Platz", () => {
  // Regression: bis zum 31.07. hiess "keine Angabe" faelschlich "nichts davon",
  // und diese Personen blieben bei freien Plaetzen uebrig.
  const r = runden(5, 5, 5);
  const s = [
    ...spieler(13, (i) => ({ [(i % 3) + 1]: 3 })),
    { id: 98, playerName: "NurName1", preferences: [], submittedAt: null, createdAt: 0 },
    { id: 99, playerName: "NurName2", preferences: [], submittedAt: null, createdAt: 0 },
  ];
  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    for (const id of [98, 99]) {
      const z = zuordnungen.find((x) => x.playerId === id);
      assert.ok(z.roundId != null, `Lauf ${lauf}: Person ${id} blieb ohne Platz`);
    }
  });
});

test("bei Unterdeckung fehlen genau so viele Plaetze wie rechnerisch", () => {
  const r = runden(5, 5, 5); // 15 Plaetze
  const s = spieler(18); // 18 Personen -> 3 muessen uebrig bleiben
  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    const ohne = zuordnungen.filter((z) => z.roundId == null).length;
    assert.equal(ohne, 3, `Lauf ${lauf}: ${ohne} ohne Platz statt 3`);
  });
});

test("das erhaltene Level passt zur Angabe der Person", () => {
  // Faengt ab, dass receivedLevel erfunden oder verwechselt wird — die Zahl
  // traegt spaeter die Statistik "wie viele haben ihren Erstwunsch bekommen".
  const r = runden(5, 5, 5);
  const s = spieler(15, (i) => ({ 1: 3, 2: 2, 3: i % 2 === 0 ? 0 : 1 }));
  const levelVon = (person, rundenId) =>
    person.preferences.find((p) => p.roundId === rundenId)?.level ?? 1;

  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    for (const z of zuordnungen) {
      const person = s.find((p) => p.id === z.playerId);
      if (z.roundId == null) {
        assert.equal(z.receivedLevel, null, `Lauf ${lauf}: ohne Platz, aber mit Level`);
        continue;
      }
      assert.equal(
        z.receivedLevel,
        levelVon(person, z.roundId),
        `Lauf ${lauf}: Person ${z.playerId} bekam Runde ${z.roundId}, Level passt nicht`,
      );
    }
  });
});

// Losreihenfolge: Gleichgueltige zuletzt, aber nur bei ausreichenden Plaetzen.
// Entscheidung vom 03.08., siehe ENTSCHEIDUNGEN.md.

/** Person `i` hat einen Wunsch, wenn `i` gerade ist. */
const GEMISCHT = (i) => (i % 2 === 0 ? { 1: 3 } : {});

test("Reihenfolge: wer einen Wunsch geaeussert hat, wird zuerst gezogen", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, GEMISCHT);
  const hatWunsch = (id) => s.find((p) => p.id === id).preferences.length > 0;

  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    // `runMatching` liefert in Losreihenfolge — der letzte mit Wunsch muss vor
    // dem ersten ohne stehen.
    const letzterMit = zuordnungen.findLastIndex((z) => hatWunsch(z.playerId));
    const ersterOhne = zuordnungen.findIndex((z) => !hatWunsch(z.playerId));
    assert.ok(letzterMit < ersterOhne, `Lauf ${lauf}: Gruppen sind nicht getrennt`);
  });
});

test("Reihenfolge: innerhalb der Gruppen wird weiterhin gelost", () => {
  const r = runden(5, 5, 5);
  const s = spieler(15, GEMISCHT);
  // Ohne echtes Mischen kaeme immer dieselbe Reihenfolge heraus. Ueber 200
  // Laeufe muss mehr als eine vorkommen — sonst ist die Verlosung tot.
  const gesehen = new Set();
  vieleLaeufe(r, s, (zuordnungen) => gesehen.add(zuordnungen.map((z) => z.playerId).join(",")));
  assert.ok(gesehen.size > 1, "die Losreihenfolge war in 200 Laeufen immer dieselbe");
});

test("Reihenfolge: bei Unterdeckung gilt die Regel NICHT", () => {
  // Sonst hiesse "zuletzt" nicht mehr nur "anderer Tisch", sondern "kein Platz"
  // — und die Regel bestrafte genau die, die ehrlich flexibel waren.
  const r = runden(3, 3, 3); // 9 Plaetze
  const s = spieler(15, GEMISCHT); // 15 Spielende
  const hatWunsch = (id) => s.find((p) => p.id === id).preferences.length > 0;

  let ohneWunschMalVorn = false;
  vieleLaeufe(r, s, (zuordnungen) => {
    if (!hatWunsch(zuordnungen[0].playerId)) ohneWunschMalVorn = true;
  });
  assert.ok(ohneWunschMalVorn, "bei Unterdeckung stand nie jemand ohne Wunsch vorn");
});

test("Reihenfolge: die Regel kostet die Gleichgueltigen keinen Platz", () => {
  // Der Kern der Entscheidung: solange Plaetze >= Spielende, entscheidet die
  // Reihenfolge nur das WO, nie das OB.
  const r = runden(5, 5, 5);
  const s = spieler(15, GEMISCHT);
  vieleLaeufe(r, s, (zuordnungen, lauf) => {
    for (const z of zuordnungen) {
      assert.notEqual(z.roundId, null, `Lauf ${lauf}: Person ${z.playerId} ohne Platz`);
    }
  });
});
