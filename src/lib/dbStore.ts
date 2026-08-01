import "server-only";
import type { DataStore } from "./dataStore";
import * as q from "./db/queries";

/**
 * Die `DataStore`-Schnittstelle gegen die Datenbank. Wird nur aus den Route
 * Handlern importiert, traegt deshalb die `server-only`-Absicherung — anders
 * als `db/queries.ts`, das auch die Skripte benutzen.
 *
 * Die Methoden sind synchron; die Schnittstelle verspricht Promises, weil sie
 * fuer `fetch` entworfen wurde. `async` genuegt.
 */
export const dbStore: DataStore = {
  async listRounds() {
    return q.listRounds();
  },

  async addRound(round) {
    return q.addRound(round);
  },

  async listEntries() {
    return q.listEntries();
  },

  async addEntry(entry) {
    return q.addEntry(entry);
  },

  async getAssignments() {
    return q.neuesteZuordnungen();
  },

  /**
   * UEBERGANGSWEISE. Der Matcher laeuft noch im Browser, also gibt es hier
   * weder Seed noch einen Schnappschuss aus dem Moment des Auslosens — beides
   * wird hier beim Schreiben erzeugt. Genau das soll es am Ende NICHT tun
   * (siehe ENTSCHEIDUNGEN.md, "Wann wird ein Matching-Lauf gespeichert"): der
   * `eingabestand` muss beim Auslosen entstehen, sonst passt er nicht zu dem
   * Ergebnis, das auf dem Schirm stand. Faellt weg, sobald die Routen
   * `preview` und `commit` stehen.
   */
  async saveAssignments(assignments) {
    q.commitLauf({
      seed: "",
      konfiguration: { verfahren: "rsd" },
      eingabestand: { runden: q.listRounds(), spieler: q.listEntries() },
      losreihenfolge: assignments.map((a) => a.playerId),
      zuordnungen: assignments,
    });
  },

  async resetAll() {
    q.resetAll();
  },
};
