import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Assignment, PlayerEntry, Round } from "./types";

/**
 * Only ever imported from route handlers (app/api/**\/route.ts) — never from
 * a "use client" page — so node:fs stays out of the browser bundle.
 */

type FileShape = {
  rounds: Round[];
  entries: PlayerEntry[];
  assignments: Assignment[] | null;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

let cache: FileShape | null = null;
// Serializes writes so concurrent submissions can't clobber each other.
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<FileShape> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(DATA_FILE, "utf-8")) as FileShape;
  } catch {
    cache = { rounds: [], entries: [], assignments: null };
  }
  return cache;
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.catch(() => undefined);
  return result;
}

export const serverStore = {
  async listRounds(): Promise<Round[]> {
    return (await load()).rounds;
  },

  addRound(round: Omit<Round, "id" | "createdAt">): Promise<Round> {
    return serialized(async () => {
      const data = await load();
      const newRound: Round = { ...round, id: randomUUID(), createdAt: Date.now() };
      data.rounds.push(newRound);
      await persist();
      return newRound;
    });
  },

  async listEntries(): Promise<PlayerEntry[]> {
    return (await load()).entries;
  },

  addEntry(entry: Omit<PlayerEntry, "id" | "createdAt">): Promise<PlayerEntry> {
    return serialized(async () => {
      const data = await load();
      const newEntry: PlayerEntry = { ...entry, id: randomUUID(), createdAt: Date.now() };
      data.entries.push(newEntry);
      await persist();
      return newEntry;
    });
  },

  async getAssignments(): Promise<Assignment[] | null> {
    return (await load()).assignments;
  },

  saveAssignments(assignments: Assignment[]): Promise<void> {
    return serialized(async () => {
      const data = await load();
      data.assignments = assignments;
      await persist();
    });
  },

  resetAll(): Promise<void> {
    return serialized(async () => {
      cache = { rounds: [], entries: [], assignments: null };
      await persist();
    });
  },
};
