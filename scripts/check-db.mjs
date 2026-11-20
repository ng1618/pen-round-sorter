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
const { getDb, closeDb, SCHEMA_VERSION } = await import("../src/lib/db/connection.ts");

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
  if (version !== SCHEMA_VERSION)
    throw new Error(`user_version ist ${version}, erwartet ${SCHEMA_VERSION}`);
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

// Ab hier ueber die Zugriffsschicht statt mit rohem SQL — geprueft wird das
// Verhalten der Anwendung, nicht das der Tabellen.
const q = await import("../src/lib/db/queries.ts");

pruefe("Zuruecksetzen laesst fruehere Tage unangetastet", () => {
  // Testkatalog, Abschnitt 15: "Tag neu aufsetzen laesst die anderen Tage
  // unangetastet". Bis zum 30.08. loeschte `resetAll()` ohne `WHERE event_id`
  // und nahm damit das festgelegte Ergebnis vom Vortag mit — am Samstagmorgen
  // waere so das Freitagsergebnis verschwunden.
  //
  // Eigenes Wochenende, damit die Zeilen der Pruefungen oben nicht hineinreden.
  q.wochenendeAnlegen("Pruefwochenende", 2);

  const r1 = q.addRound({ dmName: "Mara", title: "Tag-1-Runde", vibe: "", capacity: 4 });
  const s1 = q.addEntry({ playerName: "Sarah", preferences: [{ roundId: r1.id, level: 3 }] });
  q.commitLauf({
    seed: "",
    konfiguration: { verfahren: "rsd" },
    eingabestand: { runden: [r1], spieler: [s1] },
    losreihenfolge: [s1.id],
    zuordnungen: [{ playerId: s1.id, roundId: r1.id, receivedLevel: 3 }],
  });
  const tag1 = q.aktuellesEventId();

  const weiter = q.neuerTag();
  if (!weiter.ok) throw new Error(`neuerTag: ${weiter.fehler}`);
  const tag2 = q.aktuellesEventId();
  if (tag2 === tag1) throw new Error("neuerTag hat keinen neuen Tag angelegt");

  q.addRound({ dmName: "Nils", title: "Tag-2-Runde", vibe: "", capacity: 4 });
  q.addEntry({ playerName: "Paul", preferences: [] });

  q.resetAll();

  const zaehle = (tabelle, id) =>
    db.prepare(`SELECT count(*) AS n FROM ${tabelle} WHERE event_id = ?`).get(id).n;

  if (zaehle("runde", tag2) !== 0) throw new Error("Tag 2 hat noch Runden");
  if (zaehle("spieler", tag2) !== 0) throw new Error("Tag 2 hat noch Spielende");
  if (zaehle("matching_lauf", tag2) !== 0) throw new Error("Tag 2 hat noch Laeufe");

  if (zaehle("runde", tag1) !== 1) throw new Error("Tag 1 hat seine Runde verloren");
  if (zaehle("spieler", tag1) !== 1) throw new Error("Tag 1 hat seine Spielenden verloren");
  if (zaehle("matching_lauf", tag1) !== 1) throw new Error("Tag 1 hat seinen Lauf verloren");

  const zuordnungen = db
    .prepare(
      "SELECT count(*) AS n FROM zuordnung WHERE matching_lauf_id IN " +
        "(SELECT id FROM matching_lauf WHERE event_id = ?)",
    )
    .get(tag1).n;
  if (zuordnungen !== 1) throw new Error("Tag 1 hat seine Zuordnung verloren");

  return "Tag 2 leer, Tag 1 vollstaendig";
});

pruefe("Wochenende nullen laesst nur ein leeres Tag 1 stehen", () => {
  // 20.11.: zum Testen vor dem Abend und als Notausgang, falls etwas schiefgeht.
  // Passwort, Tokens und Name haengen am Wochenende und muessen bleiben, sonst
  // waeren die gedruckten QR-Codes ungueltig und die Ersteinrichtung offen.
  q.wochenendeAnlegen("Nullwochenende", 3);
  const w = q.aktuellesWochenendeId();
  db.prepare("UPDATE wochenende SET admin_passwort_hash = 'h', admin_passwort_salt = 's' WHERE id = ?").run(w);
  const vorher = db.prepare("SELECT name, tage, dm_token, spieler_token FROM wochenende WHERE id = ?").get(w);

  const r1 = q.addRound({ dmName: "Mara", title: "Freitag", vibe: "", capacity: 4 });
  const s1 = q.addEntry({ playerName: "Sarah", preferences: [{ roundId: r1.id, level: 3 }] });
  q.commitLauf({
    seed: "",
    konfiguration: { verfahren: "rsd" },
    eingabestand: { runden: [r1], spieler: [s1] },
    losreihenfolge: [s1.id],
    zuordnungen: [{ playerId: s1.id, roundId: r1.id, receivedLevel: 3 }],
  });
  const tag1 = q.aktuellesEventId();
  if (!q.neuerTag().ok) throw new Error("neuerTag scheiterte");
  q.addRound({ dmName: "Nils", title: "Samstag", vibe: "", capacity: 4 });
  q.addEntry({ playerName: "Paul", preferences: [] });

  q.wochenendeZuruecksetzen();

  const tage = db.prepare("SELECT id, tag FROM event WHERE wochenende_id = ?").all(w);
  if (tage.length !== 1 || tage[0].tag !== 1 || tage[0].id !== tag1) {
    throw new Error(`erwartet nur Tag 1, gefunden ${JSON.stringify(tage)}`);
  }
  for (const tabelle of ["runde", "spieler", "matching_lauf"]) {
    const n = db.prepare(`SELECT count(*) AS n FROM ${tabelle} WHERE event_id = ?`).get(tag1).n;
    if (n !== 0) throw new Error(`${tabelle} hat noch ${n} Zeilen`);
  }
  if (q.tagInfo().tag !== 1) throw new Error("tagInfo steht nicht auf Tag 1");

  const nachher = db.prepare("SELECT name, tage, dm_token, spieler_token FROM wochenende WHERE id = ?").get(w);
  if (JSON.stringify(nachher) !== JSON.stringify(vorher)) throw new Error("Wochenende wurde veraendert");
  if (q.adminPasswort()?.hash !== "h") throw new Error("Passwort ist weg");

  // Andere Wochenenden (die der Pruefungen oben) bleiben unberuehrt.
  const fremd = db.prepare("SELECT count(*) AS n FROM event WHERE wochenende_id <> ?").get(w).n;
  if (fremd === 0) throw new Error("Pruefung erwartet fruehere Wochenenden");

  return "ein leeres Tag 1, Passwort und Tokens unveraendert";
});

pruefe("Sperre ab dem Auslosen: setzen, abbrechen, zuruecksetzen", () => {
  // 20.11.: ab dem ersten "Auslosen" nehmen Gaeste nichts mehr an, Runden sind
  // gesperrt. Abbrechen nur, solange nichts festgelegt ist; Zuruecksetzen und
  // ein neuer Tag fangen offen an.
  q.wochenendeAnlegen("Sperrwochenende", 2);
  if (q.auslosungLaeuft()) throw new Error("neuer Tag startet gesperrt");

  q.auslosungStarten();
  if (!q.auslosungLaeuft()) throw new Error("Starten sperrt nicht");
  const erste = db.prepare("SELECT ausgelost_am FROM event WHERE id = ?").get(q.aktuellesEventId()).ausgelost_am;
  q.auslosungStarten();
  const zweite = db.prepare("SELECT ausgelost_am FROM event WHERE id = ?").get(q.aktuellesEventId()).ausgelost_am;
  if (erste !== zweite) throw new Error("zweites Auslosen verschiebt den Beginn");

  if (!q.auslosungAbbrechen()) throw new Error("Abbrechen ohne Festlegen scheitert");
  if (q.auslosungLaeuft()) throw new Error("Abbrechen hebt die Sperre nicht auf");

  q.auslosungStarten();
  const r = q.addRound({ dmName: "Mara", title: "Sperrrunde", vibe: "", capacity: 4 });
  const s = q.addEntry({ playerName: "Ida", preferences: [{ roundId: r.id, level: 3 }] });
  q.commitLauf({
    seed: "",
    konfiguration: { verfahren: "rsd" },
    eingabestand: { runden: [r], spieler: [s] },
    losreihenfolge: [s.id],
    zuordnungen: [{ playerId: s.id, roundId: r.id, receivedLevel: 3 }],
  });
  if (q.auslosungAbbrechen()) throw new Error("Abbrechen nach dem Festlegen gelang");
  if (!q.auslosungLaeuft()) throw new Error("Sperre nach dem Festlegen weg");

  q.resetAll();
  if (q.auslosungLaeuft()) throw new Error("Tag zuruecksetzen hebt die Sperre nicht auf");

  q.auslosungStarten();
  if (!q.neuerTag().ok) throw new Error("neuerTag scheiterte");
  if (q.auslosungLaeuft()) throw new Error("neuer Tag erbt die Sperre");

  q.auslosungStarten();
  q.wochenendeZuruecksetzen();
  if (q.auslosungLaeuft()) throw new Error("Wochenende nullen hebt die Sperre nicht auf");

  return "setzen einmalig, abbrechen nur vor dem Festlegen, Reset und neuer Tag offen";
});

// Phase 4 (15.11.): Mehrfach-Alarm und Teilnehmerliste.

pruefe("Mehrfach-Alarm zaehlt nur geaenderte Rankings", () => {
  q.wochenendeAnlegen("Alarmwochenende", 1);
  const r1 = q.addRound({ dmName: "Mara", title: "A", vibe: "", capacity: 5 });
  const r2 = q.addRound({ dmName: "Nils", title: "B", vibe: "", capacity: 5 });
  const aenderungen = (name) =>
    db
      .prepare("SELECT aenderungen FROM spieler WHERE event_id = ? AND name_key = ?")
      .get(q.aktuellesEventId(), nameKey(name)).aenderungen;

  // Netz gewackelt: zweimal dasselbe, "geht auch" einmal ausdruecklich.
  q.addEntry({ playerName: "Ida", preferences: [{ roundId: r1.id, level: 3 }] });
  q.addEntry({
    playerName: "ida ",
    preferences: [
      { roundId: r1.id, level: 3 },
      { roundId: r2.id, level: 1 },
    ],
  });
  if (aenderungen("Ida") !== 0) throw new Error("gleiches Ranking wurde als Aenderung gezaehlt");

  q.addEntry({ playerName: "Ida", preferences: [{ roundId: r2.id, level: 3 }] });
  if (aenderungen("Ida") !== 1) throw new Error("geaendertes Ranking wurde nicht gezaehlt");

  // Am Tresen angelegt, dann selbst eingereicht: erste Einreichung, keine Aenderung.
  q.addSpielerOhneEinreichung("Cem");
  q.addEntry({ playerName: "Cem", preferences: [{ roundId: r1.id, level: 3 }] });
  if (aenderungen("Cem") !== 0) throw new Error("Erst-Einreichung nach Anlegen wurde gezaehlt");

  return "gleich 0, geaendert 1, nach Anlegen 0";
});

pruefe("Teilnehmerliste kennt die Tage des Wochenendes", () => {
  q.wochenendeAnlegen("Anwesenheitswochenende", 3);
  // Tag 1: Bo und Yara
  q.addEntry({ playerName: "Bo", preferences: [] });
  q.addEntry({ playerName: "Yara", preferences: [] });
  if (!q.neuerTag().ok) throw new Error("Tag 2 nicht angelegt");
  // Tag 2: nur Yara (Bo leitet)
  q.addEntry({ playerName: "Yara", preferences: [] });
  if (!q.neuerTag().ok) throw new Error("Tag 3 nicht angelegt");
  // Tag 3: Bo wieder, Yara, dazu Fenja neu
  const bo = q.addEntry({ playerName: "bo", preferences: [] });
  const yara = q.addEntry({ playerName: "Yara", preferences: [] });
  const fenja = q.addEntry({ playerName: "Fenja", preferences: [] });

  const liste = q.teilnehmerliste();
  if (liste.tag !== 3) throw new Error(`tag ist ${liste.tag}, erwartet 3`);
  const tage = (id) => liste.eintraege.find((e) => e.spielerId === id)?.tage.join(",");
  if (tage(bo.id) !== "1,3") throw new Error(`Bo: ${tage(bo.id)}`);
  if (tage(yara.id) !== "1,2,3") throw new Error(`Yara: ${tage(yara.id)}`);
  if (tage(fenja.id) !== "3") throw new Error(`Fenja: ${tage(fenja.id)}`);
  if (liste.eintraege.length !== 3) throw new Error("fremde Wochenenden oder Tage mitgezaehlt");

  return "Bo 1,3 · Yara 1,2,3 · Fenja 3; andere Wochenenden bleiben draussen";
});

closeDb();
console.log(fehler === 0 ? "\nAlles gruen." : `\n${fehler} Pruefung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
