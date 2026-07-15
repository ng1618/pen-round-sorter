import { apiStore } from "./apiStore";
import type { Assignment, PlayerEntry, Round } from "./types";

export interface DataStore {
  listRounds(): Promise<Round[]>;
  addRound(round: Omit<Round, "id" | "createdAt">): Promise<Round>;
  listEntries(): Promise<PlayerEntry[]>;
  addEntry(entry: Omit<PlayerEntry, "id" | "createdAt">): Promise<PlayerEntry>;
  getAssignments(): Promise<Assignment[] | null>;
  saveAssignments(assignments: Assignment[]): Promise<void>;
  resetAll(): Promise<void>;
}

const ROUNDS_KEY = "prs:rounds";
const ENTRIES_KEY = "prs:entries";
const ASSIGNMENTS_KEY = "prs:assignments";
const MODE_KEY = "prs:mode";

export type Mode = "local" | "server";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function makeId(): string {
  return crypto.randomUUID();
}

export const localStorageStore: DataStore = {
  async listRounds() {
    return read<Round[]>(ROUNDS_KEY, []);
  },

  async addRound(round) {
    const rounds = read<Round[]>(ROUNDS_KEY, []);
    const newRound: Round = { ...round, id: makeId(), createdAt: Date.now() };
    write(ROUNDS_KEY, [...rounds, newRound]);
    return newRound;
  },

  async listEntries() {
    return read<PlayerEntry[]>(ENTRIES_KEY, []);
  },

  async addEntry(entry) {
    const entries = read<PlayerEntry[]>(ENTRIES_KEY, []);
    const newEntry: PlayerEntry = { ...entry, id: makeId(), createdAt: Date.now() };
    write(ENTRIES_KEY, [...entries, newEntry]);
    return newEntry;
  },

  async getAssignments() {
    return read<Assignment[] | null>(ASSIGNMENTS_KEY, null);
  },

  async saveAssignments(assignments) {
    write(ASSIGNMENTS_KEY, assignments);
  },

  async resetAll() {
    window.localStorage.removeItem(ROUNDS_KEY);
    window.localStorage.removeItem(ENTRIES_KEY);
    window.localStorage.removeItem(ASSIGNMENTS_KEY);
  },
};

/**
 * "local" keeps data in this browser only (no server needed — today's
 * behavior). "server" shares data across every device hitting this app
 * instance, via the API routes backed by serverStore.
 *
 * Defaults to "server" whenever the app isn't reached through localhost —
 * a LAN IP or tunnel URL — since that's exactly when devices need to share
 * state. The override lives in localStorage, which is already scoped per
 * origin, so a manual override set while testing on localhost has no effect
 * once you open the app via its real LAN/tunnel URL.
 */
export function getMode(): Mode {
  if (typeof window === "undefined") return "local";
  const stored = window.localStorage.getItem(MODE_KEY);
  if (stored === "local" || stored === "server") return stored;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return isLocalhost ? "local" : "server";
}

/** Pass null to clear the override and go back to auto-detecting from the hostname. */
export function setMode(mode: Mode | null): void {
  if (typeof window === "undefined") return;
  if (mode === null) window.localStorage.removeItem(MODE_KEY);
  else window.localStorage.setItem(MODE_KEY, mode);
}

export function isModeOverridden(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MODE_KEY) !== null;
}

function currentStore(): DataStore {
  return getMode() === "server" ? apiStore : localStorageStore;
}

export const dataStore: DataStore = {
  listRounds: () => currentStore().listRounds(),
  addRound: (round) => currentStore().addRound(round),
  listEntries: () => currentStore().listEntries(),
  addEntry: (entry) => currentStore().addEntry(entry),
  getAssignments: () => currentStore().getAssignments(),
  saveAssignments: (assignments) => currentStore().saveAssignments(assignments),
  resetAll: () => currentStore().resetAll(),
};
