"use client";

import { useEffect, useState } from "react";
import { dataStore, getMode, isModeOverridden, setMode, type Mode } from "@/lib/dataStore";
import { runMatching } from "@/lib/matching";
import type { Assignment, PlayerEntry, Round } from "@/lib/types";

function ordinal(n: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffixes[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;
}

export default function AdminPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [mode, setModeState] = useState<Mode>("local");
  const [overridden, setOverridden] = useState(false);

  async function refresh() {
    setRounds(await dataStore.listRounds());
    setEntries(await dataStore.listEntries());
    setAssignments(await dataStore.getAssignments());
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      setModeState(getMode());
      setOverridden(isModeOverridden());
    });
    dataStore.listRounds().then(setRounds);
    dataStore.listEntries().then(setEntries);
    dataStore.getAssignments().then(setAssignments);
  }, []);

  function handleModeChange(next: Mode | null) {
    setMode(next);
    window.location.reload();
  }

  async function handleRunMatching() {
    const result = runMatching(rounds, entries);
    await dataStore.saveAssignments(result);
    setAssignments(result);
  }

  async function handleReset() {
    if (!confirm("This clears all rounds, players, and results. Continue?")) return;
    await dataStore.resetAll();
    await refresh();
  }

  const entriesById = new Map(entries.map((e) => [e.id, e]));
  const roundsById = new Map(rounds.map((r) => [r.id, r]));

  const byRound = new Map<string, Assignment[]>();
  const unassigned: Assignment[] = [];
  for (const a of assignments ?? []) {
    if (!a.roundId) {
      unassigned.push(a);
      continue;
    }
    byRound.set(a.roundId, [...(byRound.get(a.roundId) ?? []), a]);
  }

  const choiceCounts = new Map<number, number>();
  for (const a of assignments ?? []) {
    if (!a.roundId) continue;
    const entry = entriesById.get(a.playerId);
    const rank = entry?.rankedRoundIds.indexOf(a.roundId);
    if (rank == null || rank < 0) continue;
    choiceCounts.set(rank + 1, (choiceCounts.get(rank + 1) ?? 0) + 1);
  }
  const choiceBreakdown = [...choiceCounts.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">🏰 Admin</h1>
          <p className="mt-2 text-muted">
            {rounds.length} round{rounds.length === 1 ? "" : "s"} · {entries.length}{" "}
            player{entries.length === 1 ? "" : "s"} submitted
          </p>
        </div>
        <button
          onClick={handleReset}
          className="rounded-md border border-red-700 px-3 py-1.5 text-sm text-red-700 hover:bg-red-700/10"
        >
          Reset all data
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">
          Data mode: <strong>{mode === "server" ? "Server (shared)" : "Local (this browser)"}</strong>
          {!overridden && " — auto"}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleModeChange(null)}
            className={`rounded-md border px-2 py-1 text-xs ${
              !overridden ? "border-accent bg-accent text-white" : "border-line"
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => handleModeChange("local")}
            className={`rounded-md border px-2 py-1 text-xs ${
              overridden && mode === "local" ? "border-accent bg-accent text-white" : "border-line"
            }`}
          >
            Local
          </button>
          <button
            onClick={() => handleModeChange("server")}
            className={`rounded-md border px-2 py-1 text-xs ${
              overridden && mode === "server" ? "border-accent bg-accent text-white" : "border-line"
            }`}
          >
            Server
          </button>
        </div>
      </div>

      <button
        onClick={handleRunMatching}
        disabled={rounds.length === 0 || entries.length === 0}
        className="w-fit rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        Run matching
      </button>

      {assignments && (
        <div>
          <h2 className="text-lg font-semibold text-accent">Results</h2>

          <div className="mt-3 rounded-md border border-accent/40 bg-card p-3 text-sm">
            <p className="font-medium">Match quality</p>
            <ul className="mt-2 flex flex-col gap-1 text-muted">
              {choiceBreakdown.map(([rank, count]) => (
                <li key={rank}>
                  Got their {ordinal(rank)} choice: {count} player{count === 1 ? "" : "s"}
                </li>
              ))}
              {unassigned.length > 0 && (
                <li>
                  Unassigned: {unassigned.length} player{unassigned.length === 1 ? "" : "s"}
                </li>
              )}
            </ul>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {rounds.map((round) => {
              const seated = byRound.get(round.id) ?? [];
              return (
                <div key={round.id} className="rounded-md border border-line bg-card p-3 text-sm">
                  <p className="font-medium">
                    {round.title} — DM {round.dmName} ({seated.length}/{round.capacity})
                  </p>
                  <ul className="mt-2 list-inside list-disc text-muted">
                    {seated.map((a) => (
                      <li key={a.playerId}>{entriesById.get(a.playerId)?.playerName}</li>
                    ))}
                    {seated.length === 0 && <li className="list-none italic">empty</li>}
                  </ul>
                </div>
              );
            })}

            {unassigned.length > 0 && (
              <div className="rounded-md border border-red-700/40 bg-card p-3 text-sm">
                <p className="font-medium">Unassigned ({unassigned.length})</p>
                <ul className="mt-2 list-inside list-disc text-muted">
                  {unassigned.map((a) => (
                    <li key={a.playerId}>{entriesById.get(a.playerId)?.playerName}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-accent">Rounds</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {rounds.map((r) => (
              <li key={r.id} className="rounded-md border border-line bg-card p-3 text-sm">
                {r.title} — DM {r.dmName} — cap {r.capacity}
              </li>
            ))}
            {rounds.length === 0 && <li className="text-sm text-muted">None yet.</li>}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-accent">Players</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-md border border-line bg-card p-3 text-sm">
                {e.playerName} —{" "}
                {e.rankedRoundIds
                  .map((id) => roundsById.get(id)?.title ?? "?")
                  .join(" > ")}
              </li>
            ))}
            {entries.length === 0 && <li className="text-sm text-muted">None yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
