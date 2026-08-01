// Loescht nur das Verwaltungspasswort — Runden, Spielende und Ergebnisse
// bleiben stehen. Beim naechsten Aufruf von /admin startet die
// Ersteinrichtung, und das erste dort eingegebene Passwort gilt.
//
// Aufruf:  npm run db:passwort

import { closeDb, getDb } from "../src/lib/db/connection.ts";

const { changes } = getDb()
  .prepare("UPDATE event SET admin_passwort_hash = NULL, admin_passwort_salt = NULL")
  .run();

console.log(
  changes > 0
    ? `Passwort geloescht (${changes} Event). Naechster Aufruf von /admin = Ersteinrichtung.`
    : "Kein Event vorhanden — es gab nichts zu loeschen.",
);

closeDb();
