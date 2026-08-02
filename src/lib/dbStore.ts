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

  async resetAll() {
    q.resetAll();
  },
};
