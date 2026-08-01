-- pen-round-sorter — Schema, Migrationsschritt 1 (user_version 0 -> 1)
--
-- ACHTUNG: Hier steht bewusst KEIN "PRAGMA foreign_keys = ON".
-- Das Pragma gilt pro Verbindung, nicht pro Datei — stuende es nur hier, waere
-- es bei der naechsten Verbindung wieder weg. Es wird in connection.ts bei
-- jedem Verbindungsaufbau gesetzt und dort auch zurueckgelesen.
-- (DATENBANK.md, Abschnitt 4.1)

CREATE TABLE event (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  admin_passwort_hash TEXT,
  admin_passwort_salt TEXT,
  dm_token            TEXT NOT NULL UNIQUE,
  spieler_token       TEXT NOT NULL UNIQUE,
  erstellt_am         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE spieler (
  id           INTEGER PRIMARY KEY,
  event_id     INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  name_key     TEXT NOT NULL,
  abgegeben_am TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- Traegt beides: verhindert einen zweiten Spieler bei erneuter Einreichung
  -- UND ist das Konfliktziel des Upserts. Ohne genau diese Einschraenkung
  -- scheitert "ON CONFLICT (event_id, name_key)" zur Laufzeit.
  UNIQUE (event_id, name_key)
);

CREATE TABLE runde (
  id          INTEGER PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  dm_name     TEXT NOT NULL,
  titel       TEXT NOT NULL,
  vibe        TEXT NOT NULL DEFAULT '',
  plaetze     INTEGER NOT NULL CHECK (plaetze > 0),
  aktiv       INTEGER NOT NULL DEFAULT 1 CHECK (aktiv IN (0, 1)),
  erstellt_am TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Die Rangfolge. Eine Zeile je gerankter Runde.
-- gewicht: hoch = stark. Gelesen wird nur die Reihenfolge, nie der Betrag.
CREATE TABLE spieler_gewicht (
  spieler_id INTEGER NOT NULL REFERENCES spieler(id) ON DELETE CASCADE,
  runden_id  INTEGER NOT NULL REFERENCES runde(id)   ON DELETE CASCADE,
  gewicht    INTEGER NOT NULL,

  PRIMARY KEY (spieler_id, runden_id)
) WITHOUT ROWID;

CREATE TABLE matching_lauf (
  id             INTEGER PRIMARY KEY,
  event_id       INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  seed           TEXT NOT NULL,
  konfiguration  TEXT NOT NULL,
  eingabestand   TEXT NOT NULL,
  losreihenfolge TEXT NOT NULL,
  erzeugt_am     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE zuordnung (
  id               INTEGER PRIMARY KEY,
  matching_lauf_id INTEGER NOT NULL REFERENCES matching_lauf(id) ON DELETE CASCADE,
  spieler_id       INTEGER NOT NULL REFERENCES spieler(id)       ON DELETE CASCADE,

  -- RESTRICT, nicht CASCADE: eine Runde zu loeschen wuerde festgelegte
  -- Ergebnisse mitreissen. Die Politik ist "aktiv = 0 statt loeschen" — hier
  -- wird sie strukturell erzwungen statt nur beschrieben.
  runden_id        INTEGER REFERENCES runde(id) ON DELETE RESTRICT,

  -- NULL = unzugeordnet, 1 = erster Wunsch. Bewusst ohne CHECK: sobald
  -- "fehlendeRaenge: gehtAuch" gebaut wird, gibt es "zugeteilt, aber nicht
  -- gerankt", und ein heute geschriebener CHECK muesste dann wieder aufgemacht
  -- werden.
  wunsch_rang      INTEGER,

  UNIQUE (matching_lauf_id, spieler_id)
);
