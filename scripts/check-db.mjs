// Die Abnahmekriterien aus DATENBANK.md, Abschnitt 6 — als ausfuehrbarer Test.
//
// Aufruf:  node scripts/check-db.mjs
//
// Laeuft gegen eine Wegwerfdatei, nicht gegen die Arbeitsdatenbank.

import Database from "better-sqlite3";
import { rmSync } from "node:fs";
import path from "node:path";

const DATEI = path.join(process.cwd(), ".data", "check.db");
rmSync(DATEI, { force: true });
rmSync(`${DATEI}-wal`, { force: true });
rmSync(`${DATEI}-shm`, { force: true });

// Erst die Umgebungsvariable, dann der Import: statische Importe werden nach
// oben gezogen und wuerden die Verbindung gegen die echte Datei oeffnen.
process.env.PRS_DB_FILE = DATEI;
const { getDb, closeDb } = await import("../src/lib/db/connection.ts");

const db = getDb();
let fehler = 0;

function pruefe(name, fn) {
  try {
    const hinweis = fn();
    console.log(`  ok    ${name}${hinweis ? ` — ${hinweis}` : ""}`);
  } catch (e) {
    fehler++;
    console.log(`  FEHLT ${name} — ${e.message}`);
  }
}

function wirftFehler(fn, erwartet) {
  try {
    fn();
  } catch (e) {
    if (!erwartet.test(e.message)) throw new Error(`falscher Fehler: ${e.message}`);
    return e.message;
  }
  throw new Error("kein Fehler, obwohl einer kommen musste");
}

const nameKey = (n) => n.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

console.log("Abnahme KW32:");

pruefe("alle sechs Tabellen existieren", () => {
  const erwartet = ["event", "matching_lauf", "runde", "spieler", "spieler_gewicht", "zuordnung"];
  const da = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  const fehlend = erwartet.filter((t) => !da.includes(t));
  if (fehlend.length) throw new Error(`fehlt: ${fehlend.join(", ")}`);
  return da.join(", ");
});

pruefe("Pragmas stehen richtig", () => {
  const journal = db.pragma("journal_mode", { simple: true });
  const fk = db.pragma("foreign_keys", { simple: true });
  const version = db.pragma("user_version", { simple: true });
  if (journal !== "wal") throw new Error(`journal_mode ist ${journal}`);
  if (fk !== 1) throw new Error("foreign_keys ist aus");
  if (version !== 2) throw new Error(`user_version ist ${version}`);
  return `journal_mode=${journal}, foreign_keys=${fk}, user_version=${version}`;
});

// Grunddaten fuer die weiteren Pruefungen.
const eventId = db
  .prepare("INSERT INTO event (name, dm_token, spieler_token) VALUES ('Test', 'a', 'b')")
  .run().lastInsertRowid;
const rundenId = db
  .prepare("INSERT INTO runde (event_id, dm_name, titel, plaetze) VALUES (?, 'DM', 'Runde', 5)")
  .run(eventId).lastInsertRowid;
const laufId = db
  .prepare(
    "INSERT INTO matching_lauf (event_id, seed, konfiguration, eingabestand, losreihenfolge) VALUES (?, 's', '{}', '{}', '[]')",
  )
  .run(eventId).lastInsertRowid;

const upsert = db.prepare(`
  INSERT INTO spieler (event_id, name, name_key) VALUES (@eventId, @name, @nameKey)
  ON CONFLICT (event_id, name_key) DO UPDATE SET name = excluded.name
  RETURNING id
`);

pruefe("Zuordnung mit unbekanntem spieler_id wird abgelehnt", () =>
  wirftFehler(
    () =>
      db
        .prepare("INSERT INTO zuordnung (matching_lauf_id, spieler_id) VALUES (?, 999999)")
        .run(laufId),
    /FOREIGN KEY/i,
  ),
);

// Gegenprobe zum Test darueber. Ohne sie beweist die Ablehnung oben nur, dass
// die Durchsetzung aktiv IST — nicht, dass unsere Zeile sie einschaltet.
// better-sqlite3 uebersetzt mit SQLITE_DEFAULT_FOREIGN_KEYS=1, der Test liefe
// also auch gruen, wenn das Pragma aus connection.ts geloescht wuerde.
pruefe("Gegenprobe: mit foreign_keys = OFF geht dieselbe Zeile durch", () => {
  const roh = new Database(DATEI);
  roh.pragma("foreign_keys = OFF");
  try {
    roh
      .prepare("INSERT INTO zuordnung (matching_lauf_id, spieler_id) VALUES (?, 999999)")
      .run(laufId);
    const verwaist = roh
      .prepare("SELECT count(*) AS n FROM zuordnung WHERE spieler_id = 999999")
      .get().n;
    roh.prepare("DELETE FROM zuordnung WHERE spieler_id = 999999").run();
    if (verwaist !== 1) throw new Error("die verwaiste Zeile entstand gar nicht erst");
    return "verwaiste Zeile ging durch — die Ablehnung oben kommt also vom Pragma";
  } finally {
    roh.close();
  }
});

pruefe("derselbe Spieler zweimal ergibt eine Zeile", () => {
  const a = upsert.get({ eventId, name: "Sarah", nameKey: nameKey("Sarah") });
  const b = upsert.get({ eventId, name: "Sarah", nameKey: nameKey("Sarah") });
  const anzahl = db
    .prepare("SELECT count(*) AS n FROM spieler WHERE event_id = ? AND name_key = 'sarah'")
    .get(eventId).n;
  if (anzahl !== 1) throw new Error(`${anzahl} Zeilen`);
  if (a.id !== b.id) throw new Error("RETURNING liefert unterschiedliche IDs");
  return `id ${a.id} beide Male`;
});

pruefe("JÖRG nach Jörg wird abgelehnt", () => {
  upsert.get({ eventId, name: "Jörg", nameKey: nameKey("Jörg") });
  const meldung = wirftFehler(
    () =>
      db
        .prepare("INSERT INTO spieler (event_id, name, name_key) VALUES (?, 'JÖRG', ?)")
        .run(eventId, nameKey("JÖRG")),
    /UNIQUE/i,
  );
  const anzahl = db
    .prepare("SELECT count(*) AS n FROM spieler WHERE event_id = ? AND name_key = 'jörg'")
    .get(eventId).n;
  if (anzahl !== 1) throw new Error(`${anzahl} Zeilen`);
  return meldung.split(":")[0];
});

pruefe("zweites Gewicht fuer dasselbe Paar wird abgelehnt", () => {
  const { id } = upsert.get({ eventId, name: "Bo", nameKey: nameKey("Bo") });
  const stmt = db.prepare("INSERT INTO spieler_gewicht (spieler_id, runden_id, gewicht) VALUES (?, ?, ?)");
  stmt.run(id, rundenId, 3);
  return wirftFehler(() => stmt.run(id, rundenId, 1), /UNIQUE|PRIMARY KEY/i);
});

pruefe("Runde loeschen wird blockiert, solange ein Ergebnis daran haengt", () => {
  const { id } = upsert.get({ eventId, name: "Ida", nameKey: nameKey("Ida") });
  db.prepare(
    "INSERT INTO zuordnung (matching_lauf_id, spieler_id, runden_id, erhaltenes_level) VALUES (?, ?, ?, 3)",
  ).run(laufId, id, rundenId);
  return wirftFehler(() => db.prepare("DELETE FROM runde WHERE id = ?").run(rundenId), /FOREIGN KEY/i);
});

pruefe("Spieler loeschen raeumt seine Gewichte mit ab", () => {
  const { id } = upsert.get({ eventId, name: "Cem", nameKey: nameKey("Cem") });
  db.prepare("INSERT INTO spieler_gewicht (spieler_id, runden_id, gewicht) VALUES (?, ?, 3)").run(id, rundenId);
  db.prepare("DELETE FROM spieler WHERE id = ?").run(id);
  const rest = db.prepare("SELECT count(*) AS n FROM spieler_gewicht WHERE spieler_id = ?").get(id).n;
  if (rest !== 0) throw new Error(`${rest} verwaiste Gewichte`);
  return "0 verwaiste Zeilen";
});

pruefe("Zeitstempel ist ISO-8601 mit T und Z", () => {
  const wert = db.prepare("SELECT erstellt_am FROM event WHERE id = ?").get(eventId).erstellt_am;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(wert)) throw new Error(wert);
  return wert;
});

pruefe("nur ein Topwunsch je Person", () => {
  const { id } = upsert.get({ eventId, name: "Yara", nameKey: nameKey("Yara") });
  const zweiteRunde = db
    .prepare("INSERT INTO runde (event_id, dm_name, titel, plaetze) VALUES (?, 'DM2', 'Runde 2', 5)")
    .run(eventId).lastInsertRowid;
  const stmt = db.prepare("INSERT INTO spieler_gewicht (spieler_id, runden_id, gewicht) VALUES (?, ?, 3)");
  stmt.run(id, rundenId);
  return wirftFehler(() => stmt.run(id, zweiteRunde), /UNIQUE/i);
});

pruefe("zwei zweite Wuensche sind dagegen erlaubt", () => {
  const { id } = upsert.get({ eventId, name: "Mirko", nameKey: nameKey("Mirko") });
  const dritteRunde = db
    .prepare("INSERT INTO runde (event_id, dm_name, titel, plaetze) VALUES (?, 'DM3', 'Runde 3', 5)")
    .run(eventId).lastInsertRowid;
  const stmt = db.prepare("INSERT INTO spieler_gewicht (spieler_id, runden_id, gewicht) VALUES (?, ?, 2)");
  stmt.run(id, rundenId);
  stmt.run(id, dritteRunde);
  return "Gleichstand auf Level 2 geht durch";
});

pruefe("keine verletzten Fremdschluessel in der Datei", () => {
  // Ein Kommando, keine Einstellung: prueft ALLE bestehenden Beziehungen und
  // faende auch das, was eine Verbindung mit abgeschaltetem Pragma angerichtet
  // haette.
  const verletzungen = db.pragma("foreign_key_check");
  if (verletzungen.length) throw new Error(`${verletzungen.length} Verletzung(en)`);
  return "0";
});

closeDb();
console.log(fehler === 0 ? "\nAlles gruen." : `\n${fehler} Pruefung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
