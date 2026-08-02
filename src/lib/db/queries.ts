import { randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "./connection.ts";
import { LEVEL_STANDARD, type Assignment, type Level, type PlayerEntry, type Round } from "../types.ts";

/**
 * Die Datenzugriffsschicht: der EINZIGE Ort, an dem Tabellenzeilen und
 * Anwendungstypen aufeinandertreffen.
 *
 * Bewusst ohne `import "server-only"` — `scripts/seed.mjs` benutzt dieses
 * Modul, damit es genau eine Definition davon gibt, wie ein Spieler
 * geschrieben wird. Die Absicherung sitzt in `./index`, das der Anwendungscode
 * importiert.
 *
 * Zwei Umrechnungen wohnen hier und sonst nirgends:
 * - Zeit: `createdAt: number` (Millisekunden) <-> TEXT ISO-8601 UTC
 * - Vorlieben: `preferences` <-> Zeilen in `spieler_gewicht` (Gewicht = Level,
 *   fehlende Zeile = LEVEL_STANDARD)
 */

type EventZeile = { id: number };
type RundenZeile = {
  id: number;
  dm_name: string;
  titel: string;
  vibe: string;
  plaetze: number;
  erstellt_am: string;
};
type SpielerZeile = {
  id: number;
  name: string;
  abgegeben_am: string | null;
  erstellt_am: string;
};

function nachMillisekunden(iso: string): number {
  return Date.parse(iso);
}

function nachIso(millisekunden: number): string {
  return new Date(millisekunden).toISOString();
}

/** Dieselbe Normalisierung wie in DATENBANK.md, Abschnitt 4.2. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

/**
 * Muss **unratbar** sein — das ist der ganze Zweck der Tokens fuer `/dm` und
 * `/rank` (Entscheidung vom 29.07.). `Math.random()` waere dafuer untauglich:
 * vorhersagbar, nicht fuer Sicherheitszwecke gedacht. Gefunden im
 * Code-Durchgang am 01.08., bevor die Tokens in KW38 benutzt werden.
 */
function zufallsToken(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Ein Event, implizit. Mehrere Events parallel stehen in Abschnitt 16 des
 * Arbeitsdokuments bewusst als "nicht bis zum Event" — bis dahin ist "das
 * aktuelle Event" das neueste, und wenn es keines gibt, wird eines angelegt.
 */
export function aktuellesEventId(db: Database.Database = getDb()): number {
  const vorhanden = db
    .prepare("SELECT id FROM event ORDER BY id DESC LIMIT 1")
    .get() as EventZeile | undefined;
  if (vorhanden) return vorhanden.id;

  return Number(
    db
      .prepare("INSERT INTO event (name, dm_token, spieler_token) VALUES (?, ?, ?)")
      .run("Spieleabend", zufallsToken(), zufallsToken()).lastInsertRowid,
  );
}

export function listRounds(db: Database.Database = getDb()): Round[] {
  const eventId = aktuellesEventId(db);
  const zeilen = db
    .prepare(
      "SELECT id, dm_name, titel, vibe, plaetze, erstellt_am FROM runde " +
        "WHERE event_id = ? AND aktiv = 1 ORDER BY id",
    )
    .all(eventId) as RundenZeile[];

  return zeilen.map((z) => ({
    id: z.id,
    dmName: z.dm_name,
    title: z.titel,
    vibe: z.vibe,
    capacity: z.plaetze,
    createdAt: nachMillisekunden(z.erstellt_am),
  }));
}

export function addRound(
  eingabe: Omit<Round, "id" | "createdAt">,
  db: Database.Database = getDb(),
): Round {
  const eventId = aktuellesEventId(db);
  const erstelltAm = nachIso(Date.now());

  const id = Number(
    db
      .prepare(
        "INSERT INTO runde (event_id, dm_name, titel, vibe, plaetze, erstellt_am) " +
          "VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(eventId, eingabe.dmName, eingabe.title, eingabe.vibe, eingabe.capacity, erstelltAm)
      .lastInsertRowid,
  );

  return { ...eingabe, id, createdAt: nachMillisekunden(erstelltAm) };
}

/**
 * Platzzahl einer Runde aendern — Sache des Wirts, nicht des DM: die Zahl ist
 * keine Angabe ueber das Spiel, sondern eine Beobachtung ueber den Raum
 * (wer da ist, wie viele Stuehle passen). Deshalb kollidiert es auch nicht mit
 * "keine nachtraegliche Umbesetzung", das Besetzung und Inhalt betraf.
 */
export function setRundenPlaetze(
  id: number,
  plaetze: number,
  db: Database.Database = getDb(),
): boolean {
  return (
    db
      .prepare("UPDATE runde SET plaetze = ? WHERE id = ? AND event_id = ?")
      .run(plaetze, id, aktuellesEventId(db)).changes > 0
  );
}

export function listEntries(db: Database.Database = getDb()): PlayerEntry[] {
  const eventId = aktuellesEventId(db);
  const spieler = db
    .prepare(
      "SELECT id, name, abgegeben_am, erstellt_am FROM spieler WHERE event_id = ? ORDER BY id",
    )
    .all(eventId) as SpielerZeile[];

  // Das Gewicht IST das Level. Fehlt eine Runde, gilt LEVEL_STANDARD — deshalb
  // muss hier nichts aufgefuellt werden.
  const gewichte = db
    .prepare(
      "SELECT g.spieler_id, g.runden_id, g.gewicht FROM spieler_gewicht g " +
        "JOIN spieler s ON s.id = g.spieler_id WHERE s.event_id = ? " +
        "ORDER BY g.spieler_id, g.gewicht DESC",
    )
    .all(eventId) as Array<{ spieler_id: number; runden_id: number; gewicht: Level }>;

  const jeSpieler = new Map<number, Array<{ roundId: number; level: Level }>>();
  for (const g of gewichte) {
    jeSpieler.set(g.spieler_id, [
      ...(jeSpieler.get(g.spieler_id) ?? []),
      { roundId: g.runden_id, level: g.gewicht },
    ]);
  }

  return spieler.map((s) => ({
    id: s.id,
    playerName: s.name,
    preferences: jeSpieler.get(s.id) ?? [],
    submittedAt: s.abgegeben_am === null ? null : nachMillisekunden(s.abgegeben_am),
    createdAt: nachMillisekunden(s.erstellt_am),
  }));
}

/**
 * Eine Einreichung. Upsert auf `(event_id, name_key)`, damit doppeltes
 * Absenden die erste Einreichung ersetzt statt einen zweiten Spieler
 * anzulegen — und `RETURNING id`, weil `lastInsertRowid` bei `DO UPDATE` nicht
 * verlaesslich die getroffene Zeile liefert.
 */
export function addEntry(
  eingabe: Omit<PlayerEntry, "id" | "createdAt" | "submittedAt">,
  db: Database.Database = getDb(),
): PlayerEntry {
  const eventId = aktuellesEventId(db);
  const jetzt = nachIso(Date.now());

  const schreiben = db.transaction((): PlayerEntry => {
    const { id } = db
      .prepare(
        "INSERT INTO spieler (event_id, name, name_key, abgegeben_am, erstellt_am) " +
          "VALUES (@eventId, @name, @nameKey, @jetzt, @jetzt) " +
          "ON CONFLICT (event_id, name_key) DO UPDATE SET " +
          "  name = excluded.name, abgegeben_am = excluded.abgegeben_am " +
          "RETURNING id",
      )
      .get({ eventId, name: eingabe.playerName, nameKey: nameKey(eingabe.playerName), jetzt }) as {
      id: number;
    };

    // Eine erneute Einreichung ersetzt die Rangfolge, sie ergaenzt sie nicht.
    db.prepare("DELETE FROM spieler_gewicht WHERE spieler_id = ?").run(id);
    const gewichtSetzen = db.prepare(
      "INSERT INTO spieler_gewicht (spieler_id, runden_id, gewicht) VALUES (?, ?, ?)",
    );
    // Nur Abweichungen vom Standard speichern — "geht auch" ist die
    // Voreinstellung und braucht keine Zeile.
    for (const p of eingabe.preferences) {
      if (p.level === LEVEL_STANDARD) continue;
      gewichtSetzen.run(id, p.roundId, p.level);
    }

    const zeile = db
      .prepare("SELECT id, name, abgegeben_am, erstellt_am FROM spieler WHERE id = ?")
      .get(id) as SpielerZeile;

    return {
      id: zeile.id,
      playerName: zeile.name,
      preferences: eingabe.preferences,
      submittedAt: zeile.abgegeben_am === null ? null : nachMillisekunden(zeile.abgegeben_am),
      createdAt: nachMillisekunden(zeile.erstellt_am),
    };
  });

  return schreiben();
}

/**
 * Spieler anlegen OHNE Einreichung (`abgegeben_am` bleibt NULL). Gebraucht,
 * weil die Kapazitaetsanzeige laut Abschnitt 2 dauerhaft sichtbar sein soll:
 * wer sich anmeldet, aber noch nicht rankt, zaehlt trotzdem in den
 * Platzbedarf. Ohne das faellt Unterdeckung erst beim Matching auf.
 */
export function addSpielerOhneEinreichung(
  name: string,
  db: Database.Database = getDb(),
): PlayerEntry {
  const eventId = aktuellesEventId(db);
  const erstelltAm = nachIso(Date.now());

  const { id } = db
    .prepare(
      "INSERT INTO spieler (event_id, name, name_key, erstellt_am) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (event_id, name_key) DO UPDATE SET name = excluded.name RETURNING id",
    )
    .get(eventId, name, nameKey(name), erstelltAm) as { id: number };

  return {
    id,
    playerName: name,
    preferences: [],
    submittedAt: null,
    createdAt: nachMillisekunden(erstelltAm),
  };
}

/** Gehashtes Verwaltungspasswort des aktuellen Events, oder `null` vor der Ersteinrichtung. */
export function adminPasswort(
  db: Database.Database = getDb(),
): { hash: string; salt: string } | null {
  const eventId = aktuellesEventId(db);
  const zeile = db
    .prepare("SELECT admin_passwort_hash AS hash, admin_passwort_salt AS salt FROM event WHERE id = ?")
    .get(eventId) as { hash: string | null; salt: string | null };
  if (!zeile?.hash || !zeile.salt) return null;
  return { hash: zeile.hash, salt: zeile.salt };
}

/** Zaehler, der in die Sitzungssignatur eingeht. Hochzaehlen = alles abmelden. */
export function sitzungsVersion(db: Database.Database = getDb()): number {
  const zeile = db
    .prepare("SELECT sitzungs_version AS v FROM event WHERE id = ?")
    .get(aktuellesEventId(db)) as { v: number };
  return zeile?.v ?? 0;
}

export function sitzungsVersionErhoehen(db: Database.Database = getDb()): void {
  db.prepare("UPDATE event SET sitzungs_version = sitzungs_version + 1 WHERE id = ?").run(
    aktuellesEventId(db),
  );
}

export function setAdminPasswort(
  hash: string,
  salt: string,
  db: Database.Database = getDb(),
): void {
  db.prepare("UPDATE event SET admin_passwort_hash = ?, admin_passwort_salt = ? WHERE id = ?").run(
    hash,
    salt,
    aktuellesEventId(db),
  );
}

/**
 * Spieler entfernen — fuer Absagen am Eventabend.
 *
 * Die Gewichte gehen per CASCADE mit, und ebenso die `zuordnung`-Zeilen aus
 * bereits festgelegten Laeufen. Dass die Historie das ueberlebt, haengt daran,
 * dass `eingabestand` eine vollstaendige Kopie ist (offene Frage 1 in
 * DATENBANK.md) — der Lauf bleibt also rekonstruierbar, auch wenn die Person
 * aus der Tabelle verschwindet.
 */
export function deleteSpieler(id: number, db: Database.Database = getDb()): boolean {
  const eventId = aktuellesEventId(db);
  return db.prepare("DELETE FROM spieler WHERE id = ? AND event_id = ?").run(id, eventId).changes > 0;
}

export type LaufEingabe = {
  seed: string;
  konfiguration: Record<string, unknown>;
  eingabestand: unknown;
  losreihenfolge: number[];
  zuordnungen: Assignment[];
};

/**
 * Ein Lauf wird erst hier zur Zeile — verworfene Wuerfe hat es nie gegeben.
 * Deshalb gibt es auch kein "gewaehlt"-Kennzeichen: der neueste Lauf gilt.
 */
export function commitLauf(eingabe: LaufEingabe, db: Database.Database = getDb()): number {
  const eventId = aktuellesEventId(db);

  const schreiben = db.transaction((): number => {
    const laufId = Number(
      db
        .prepare(
          "INSERT INTO matching_lauf " +
            "(event_id, seed, konfiguration, eingabestand, losreihenfolge, erzeugt_am) " +
            "VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          eventId,
          eingabe.seed,
          JSON.stringify(eingabe.konfiguration),
          JSON.stringify(eingabe.eingabestand),
          JSON.stringify(eingabe.losreihenfolge),
          nachIso(Date.now()),
        ).lastInsertRowid,
    );

    const zuordnen = db.prepare(
      "INSERT INTO zuordnung (matching_lauf_id, spieler_id, runden_id, erhaltenes_level) " +
        "VALUES (?, ?, ?, ?)",
    );
    for (const z of eingabe.zuordnungen) {
      zuordnen.run(laufId, z.playerId, z.roundId, z.receivedLevel);
    }
    return laufId;
  });

  return schreiben();
}

/**
 * Der neueste Lauf **vollstaendig**, inklusive seines Schnappschusses — die
 * Grundlage fuer eine Handkorrektur: die wird als *neuer* Lauf festgelegt, nicht
 * als Aenderung am bestehenden, damit ein gespeicherter Lauf weiterhin das ist,
 * was damals herauskam.
 */
export function neuesterLaufVoll(db: Database.Database = getDb()) {
  const eventId = aktuellesEventId(db);
  const lauf = db
    .prepare(
      "SELECT id, seed, konfiguration, eingabestand, losreihenfolge FROM matching_lauf " +
        "WHERE event_id = ? ORDER BY erzeugt_am DESC, id DESC LIMIT 1",
    )
    .get(eventId) as
    | { id: number; seed: string; konfiguration: string; eingabestand: string; losreihenfolge: string }
    | undefined;
  if (!lauf) return null;

  return {
    seed: lauf.seed,
    konfiguration: JSON.parse(lauf.konfiguration) as Record<string, unknown>,
    eingabestand: JSON.parse(lauf.eingabestand) as { runden: Round[]; spieler: PlayerEntry[] },
    losreihenfolge: JSON.parse(lauf.losreihenfolge) as number[],
    zuordnungen: neuesteZuordnungen(db) ?? [],
  };
}

/** Der neueste festgelegte Lauf. `null`, wenn noch keiner festgelegt wurde. */
export function neuesteZuordnungen(db: Database.Database = getDb()): Assignment[] | null {
  const eventId = aktuellesEventId(db);
  const lauf = db
    .prepare("SELECT id FROM matching_lauf WHERE event_id = ? ORDER BY erzeugt_am DESC, id DESC LIMIT 1")
    .get(eventId) as { id: number } | undefined;
  if (!lauf) return null;

  const zeilen = db
    .prepare(
      "SELECT spieler_id, runden_id, erhaltenes_level FROM zuordnung WHERE matching_lauf_id = ? ORDER BY id",
    )
    .all(lauf.id) as Array<{ spieler_id: number; runden_id: number | null; erhaltenes_level: Level | null }>;

  return zeilen.map((z) => ({
    playerId: z.spieler_id,
    roundId: z.runden_id,
    receivedLevel: z.erhaltenes_level,
  }));
}

/**
 * Runden, Spielende und Laeufe weg — **Event und Passwort bleiben stehen**.
 *
 * Frueher wurde das Event mitgeloescht. Das nahm das Verwaltungspasswort mit,
 * und danach war die Ersteinrichtung wieder offen: wer als Naechster POSTet,
 * besitzt die Verwaltung. Genau der Ablauf ist am Eventabend wahrscheinlich
 * (kurz zuruecksetzen, 15 Handys im selben Netz), belegt im Sicherheitsdurchgang
 * vom 01.08. Die Entscheidung vom 29.07. sah das Zuruecksetzen des Passworts
 * ausdruecklich vor — dort aber als Nebeneffekt, nicht als Wiederherstellungsweg:
 * der ist Host-Zugriff, weil man den Knopf ja gerade nicht druecken kann, wenn
 * man nicht hineinkommt.
 */
export function resetAll(db: Database.Database = getDb()): void {
  db.transaction(() => {
    // Reihenfolge zaehlt: zuordnung.runden_id steht auf RESTRICT und wuerde das
    // Loeschen der Runden sonst blockieren.
    db.exec("DELETE FROM zuordnung");
    db.exec("DELETE FROM matching_lauf");
    db.exec("DELETE FROM spieler"); // spieler_gewicht faellt per CASCADE mit
    db.exec("DELETE FROM runde");
  })();
}
