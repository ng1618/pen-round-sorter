import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Verbindung, Pragmas, Migration. Bewusst OHNE `import "server-only"` — dieses
 * Modul wird auch von den Skripten unter `scripts/` benutzt, die in nacktem
 * Node laufen. Dort wuerde `server-only` nicht etwa ignoriert, sondern beim
 * Import eine Ausnahme werfen (siehe `src/lib/db/index.ts`).
 *
 * Der Anwendungscode importiert nicht diese Datei, sondern `./index`.
 */

const DEFAULT_FILE = path.join(process.cwd(), ".data", "pen-round-sorter.db");

/** Ueberschreibbar, damit Tests gegen eine Wegwerfdatei laufen koennen. */
function dbFile(): string {
  return process.env.PRS_DB_FILE ?? DEFAULT_FILE;
}

function schemaSql(): string {
  const file = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
  if (!existsSync(file)) {
    throw new Error(
      `schema.sql nicht gefunden unter ${file}. Lokal heisst das: falsches ` +
        `Arbeitsverzeichnis. Im Deployment (KW33) heisst es, dass die Datei ` +
        `nicht mitgeliefert wurde — dann muss sie ins Abbild kopiert werden.`,
    );
  }
  return readFileSync(file, "utf-8");
}

/**
 * Die Pragmas als Liste statt als verstreute Aufrufe — aus einem Grund: der
 * Fehler ist nie ein Tippfehler, sondern eine Verbindung, die eines nicht
 * abbekommen hat, ohne dass es jemand merkt. Deshalb wird jedes nach dem Setzen
 * zurueckgelesen und geprueft.
 *
 * Setz- und Leseform sind NICHT dasselbe: gesetzt wird `foreign_keys = ON`,
 * zurueck kommt `1`; gesetzt wird `journal_mode = WAL`, zurueck kommt `"wal"`.
 * Darum drei Felder und kein Paar aus Name und Wert.
 *
 * Die beiden Listen bleiben getrennt, obwohl die Schleife sie zusammenwirft:
 * sonst ist genau der Unterschied wieder unsichtbar, auf den es ankommt.
 *
 * Nicht hierher gehoeren `page_size` und `auto_vacuum` — die wirken nur, solange
 * die Datenbank leer ist, und muessten in den ersten Migrationsschritt.
 */

/** In der Datei gespeichert. Einmal genuegt, erneutes Setzen ist ein No-Op. */
const DATEI_PRAGMAS = [{ setzen: "journal_mode = WAL", lesen: "journal_mode", erwartet: "wal" }] as const;

/**
 * Pro Verbindung. Muss bei JEDEM Oeffnen gesetzt werden.
 *
 * `foreign_keys` ist in SQLite standardmaessig AUS — nur nicht hier:
 * better-sqlite3 uebersetzt mit SQLITE_DEFAULT_FOREIGN_KEYS=1. Die Zeile
 * repariert also nichts, sie sichert zu. Denn die Voreinstellung gehoert dem
 * Treiber, nicht der Datei: sqlite3-Kommandozeile, node:sqlite und
 * Microsoft.Data.Sqlite haben sie aus.
 */
const VERBINDUNGS_PRAGMAS = [
  { setzen: "foreign_keys = ON", lesen: "foreign_keys", erwartet: 1 },
  // better-sqlite3 setzt das ueber die Option `timeout` ohnehin auf 5000 —
  // hier steht es sichtbar und wird mitgeprueft. Ohne busy_timeout bekommt der
  // zweite gleichzeitige Schreiber sofort SQLITE_BUSY.
  { setzen: "busy_timeout = 5000", lesen: "busy_timeout", erwartet: 5000 },
] as const;

function pragmasPruefen(db: Database.Database, wann: string): void {
  for (const pragma of [...DATEI_PRAGMAS, ...VERBINDUNGS_PRAGMAS]) {
    const ist = db.pragma(pragma.lesen, { simple: true });
    if (ist !== pragma.erwartet) {
      throw new Error(
        `Pragma ${pragma.lesen} stimmt ${wann} nicht: ist ${JSON.stringify(ist)}, ` +
          `erwartet ${JSON.stringify(pragma.erwartet)}.`,
      );
    }
  }
}

function pragmasSetzen(db: Database.Database): void {
  for (const pragma of [...DATEI_PRAGMAS, ...VERBINDUNGS_PRAGMAS]) db.pragma(pragma.setzen);
  pragmasPruefen(db, "nach dem Setzen");
}

/**
 * Ein Eintrag je Schemastand. Der Index ist die Zielversion: Schritt 0 fuehrt
 * von `user_version` 0 auf 1. Neue Aenderungen kommen hinten dazu, bestehende
 * werden nie angefasst — sonst laufen Datenbanken auseinander, die den alten
 * Schritt schon gesehen haben.
 */
const MIGRATIONS: Array<(db: Database.Database) => void> = [
  (db) => db.exec(schemaSql()),

  // Schritt 2 (31.07., abends): Praeferenz-Levels statt geordneter Rangfolge.
  //
  // `schema.sql` wird dafuer NICHT angefasst — Datenbanken, die Schritt 1 schon
  // gesehen haben, wuerden die Aenderung sonst nie bekommen. Deshalb steht die
  // Aenderung hier und nicht dort.
  (db) =>
    db.exec(`
      -- Hoechstens ein Topwunsch je Person. Ohne das hiesse "hat seinen
      -- Erstwunsch bekommen" nichts, weil man alles mit 3 markieren koennte.
      CREATE UNIQUE INDEX ux_ein_topwunsch ON spieler_gewicht (spieler_id)
        WHERE gewicht = 3;

      -- Umbenannt, weil sich die Bedeutung umgedreht hat: frueher 1 = erster
      -- Wunsch (klein = gut), jetzt das erhaltene Level (gross = gut). Denselben
      -- Namen mit neuer Bedeutung weiterzubenutzen waere die schlimmere Variante.
      ALTER TABLE zuordnung RENAME COLUMN wunsch_rang TO erhaltenes_level;
    `),
];

function migrate(db: Database.Database): void {
  const current = db.pragma("user_version", { simple: true }) as number;

  for (let version = current; version < MIGRATIONS.length; version++) {
    // DDL laeuft in SQLite transaktional: bricht ein Schritt ab, ist weder das
    // halbe Schema noch die neue Versionsnummer da.
    db.transaction(() => {
      MIGRATIONS[version](db);
      // Pragmas nehmen keine gebundenen Parameter, die Zahl muss in den Text.
      // Unbedenklich, weil sie aus dem Schleifenindex kommt, nicht von aussen.
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}

let handle: Database.Database | null = null;

export function getDb(): Database.Database {
  if (handle) return handle;

  const file = dbFile();
  mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);

  // Vor migrate(): `foreign_keys` ist innerhalb einer Transaktion wirkungslos,
  // und migrate() arbeitet mit Transaktionen.
  pragmasSetzen(db);

  migrate(db);

  // Noch einmal prüfen, absichtlich ohne neu zu setzen. Das Standardrezept, um
  // in SQLite eine Spalte zu aendern, verlangt "PRAGMA foreign_keys = OFF"
  // waehrend des Tabellenumbaus — ein Migrationsschritt, der das Wiedereinschalten
  // vergisst, wuerde die Durchsetzung fuer die gesamte Lebensdauer dieser
  // Verbindung stilllegen. Stilles Wiedereinschalten wuerde den Fehler
  // verstecken, deshalb wird hier gemeldet statt repariert.
  pragmasPruefen(db, "nach der Migration");

  handle = db;
  return handle;
}

/** Nur fuer Skripte und Tests: Verbindung schliessen und Zwischenspeicher leeren. */
export function closeDb(): void {
  handle?.close();
  handle = null;
}
