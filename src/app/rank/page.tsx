"use client";

import { useEffect, useState } from "react";
import { dataStore } from "@/lib/dataStore";
import type { Round } from "@/lib/types";

const MAX_CHOICES = 4;

export default function RankPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [ranked, setRanked] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dataStore.listRounds().then(setRounds);
  }, []);

  const roundsById = new Map(rounds.map((r) => [r.id, r]));
  const available = rounds.filter((r) => !ranked.includes(r.id));

  function addChoice(id: string) {
    setRanked((prev) => (prev.length >= MAX_CHOICES ? prev : [...prev, id]));
  }

  function removeChoice(id: string) {
    setRanked((prev) => prev.filter((r) => r !== id));
  }

  function move(index: number, direction: -1 | 1) {
    setRanked((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim() || ranked.length === 0) return;

    await dataStore.addEntry({ playerName: playerName.trim(), rankedRoundIds: ranked });
    setSubmitted(true);
    setPlayerName("");
    setRanked([]);
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">🛡️ You&apos;re in!</h1>
        <p className="text-muted">
          Your ranking has been submitted. The innkeeper will run the sort once
          everyone&apos;s in.
        </p>
        <button
          className="w-fit rounded-md border border-line bg-card px-4 py-2 text-sm"
          onClick={() => setSubmitted(false)}
        >
          Submit another player
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">🛡️ Choose your table</h1>
        <p className="mt-2 text-muted">
          Rank your top {MAX_CHOICES} tables, from most to least wanted.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            className="rounded-md border border-line bg-card px-3 py-2"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            required
          />
        </label>

        <div>
          <h2 className="text-sm font-semibold text-accent">
            Your ranking ({ranked.length}/{MAX_CHOICES})
          </h2>
          <ol className="mt-2 flex flex-col gap-2">
            {ranked.map((id, i) => {
              const round = roundsById.get(id);
              if (!round) return null;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-md border border-accent/40 bg-card p-3 text-sm"
                >
                  <span className="font-semibold">#{i + 1}</span>
                  <span className="flex-1">
                    {round.title} — DM {round.dmName}
                  </span>
                  <button
                    type="button"
                    className="text-muted hover:text-foreground"
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-muted hover:text-foreground"
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-red-700 hover:text-red-800"
                    onClick={() => removeChoice(id)}
                  >
                    remove
                  </button>
                </li>
              );
            })}
            {ranked.length === 0 && (
              <li className="text-sm text-muted">Add rounds from the list below.</li>
            )}
          </ol>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-accent">Available rounds</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {available.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-md border border-line bg-card p-3 text-sm"
              >
                <div className="flex-1">
                  <span className="font-medium">{r.title}</span> — DM {r.dmName} — cap{" "}
                  {r.capacity}
                  {r.vibe && <p className="mt-1 text-muted">{r.vibe}</p>}
                </div>
                <button
                  type="button"
                  disabled={ranked.length >= MAX_CHOICES}
                  className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
                  onClick={() => addChoice(r.id)}
                >
                  Add
                </button>
              </li>
            ))}
            {available.length === 0 && rounds.length > 0 && (
              <li className="text-sm text-muted">All rounds ranked.</li>
            )}
            {rounds.length === 0 && (
              <li className="text-sm text-muted">No rounds submitted yet — check back soon.</li>
            )}
          </ul>
        </div>

        <button
          type="submit"
          disabled={!playerName.trim() || ranked.length === 0}
          className="w-fit rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Submit ranking
        </button>
      </form>
    </div>
  );
}
