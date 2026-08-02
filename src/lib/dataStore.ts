import { apiStore } from "./apiStore";
import type { Assignment, PlayerEntry, Round } from "./types";

/**
 * Eine Ablage, ein Zustand. Seit dem 31.07. gibt es keinen `local`-Modus mehr:
 * frueher benutzte `localhost` den `localStorage` des Browsers und jede andere
 * Adresse den Server — Schreibtisch und Handy sahen also verschiedene Daten,
 * genau beim Testen ueber mehrere Geraete. Jetzt geht alles ueber die
 * API-Routen in dieselbe SQLite-Datei.
 */
export interface DataStore {
  listRounds(): Promise<Round[]>;
  addRound(round: Omit<Round, "id" | "createdAt">): Promise<Round>;
  listEntries(): Promise<PlayerEntry[]>;
  addEntry(entry: Omit<PlayerEntry, "id" | "createdAt" | "submittedAt">): Promise<PlayerEntry>;
  getAssignments(): Promise<Assignment[] | null>;
  resetAll(): Promise<void>;
  // Geschrieben wird eine Auslosung nur ueber /api/matching/commit — nicht von
  // hier aus. Sonst gaebe es zwei Wege ins Schreiben, und einer davon koennte
  // den Schnappschuss erst beim Speichern erzeugen.
}

export const dataStore: DataStore = apiStore;
