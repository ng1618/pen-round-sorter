import type { Assignment, PlayerEntry, Round } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Shares data across every device hitting this app instance, via the API routes. */
export const apiStore = {
  listRounds: () => getJson<Round[]>("/api/rounds"),
  addRound: (round: Omit<Round, "id" | "createdAt">) => postJson<Round>("/api/rounds", round),
  listEntries: () => getJson<PlayerEntry[]>("/api/entries"),
  addEntry: (entry: Omit<PlayerEntry, "id" | "createdAt">) =>
    postJson<PlayerEntry>("/api/entries", entry),
  getAssignments: () => getJson<Assignment[] | null>("/api/assignments"),
  resetAll: () => postJson<void>("/api/reset", {}),
};
