"use client";

import { useEffect, useState } from "react";
import { dataStore } from "@/lib/dataStore";
import { LEVELS, LEVEL_STANDARD, LEVEL_TOP, type Level, type Round } from "@/lib/types";

export default function RankPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [levels, setLevels] = useState<Record<number, Level>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dataStore.listRounds().then(setRounds);
  }, []);

  const levelOf = (roundId: number): Level => levels[roundId] ?? LEVEL_STANDARD;
  const topPick = rounds.find((r) => levelOf(r.id) === LEVEL_TOP);

  /** Der Topwunsch ist einmalig: ihn woanders zu setzen, nimmt ihn hier weg. */
  function choose(roundId: number, level: Level) {
    setLevels((prev) => {
      const next = { ...prev };
      if (level === LEVEL_TOP) {
        for (const key of Object.keys(next)) {
          if (next[Number(key)] === LEVEL_TOP) next[Number(key)] = LEVEL_STANDARD;
        }
      }
      next[roundId] = level;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim()) return;

    await dataStore.addEntry({
      playerName: playerName.trim(),
      preferences: rounds.map((r) => ({ roundId: r.id, level: levelOf(r.id) })),
    });
    setSubmitted(true);
    setPlayerName("");
    setLevels({});
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">🛡️ Angekommen!</h1>
        <p className="text-muted">
          Deine Wünsche sind angekommen. Der Wirt lost aus, sobald alle da sind.
        </p>
        <button
          className="w-fit rounded-md border border-line bg-card px-4 py-2 text-sm"
          onClick={() => setSubmitted(false)}
        >
          Für jemand anderen abgeben
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">🛡️ Such dir deinen Tisch</h1>
        <p className="mt-2 text-muted">
          Sag zu jedem Tisch, wie sehr du willst. Alles, was du nicht anfasst,
          gilt als &bdquo;geht auch&ldquo; &mdash; nur den Namen abzuschicken heißt also{" "}
          <strong>mir ist alles recht</strong>, nicht &bdquo;nichts davon&ldquo;. Einen Tisch
          darfst du 🔥 <strong>unbedingt</strong> geben, genau einen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <input
            className="rounded-md border border-line bg-card px-3 py-2"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            required
          />
        </label>

        <ul className="flex flex-col gap-3">
          {rounds.map((r) => (
            <li key={r.id} className="rounded-md border border-line bg-card p-3 text-sm">
              <div>
                <span className="font-medium">{r.title}</span> — Leitung {r.dmName} — {r.capacity} Plätze
                {r.vibe && <p className="mt-1 text-muted">{r.vibe}</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Wunsch für ${r.title}`}>
                {LEVELS.map(({ level, emoji, label }) => {
                  const active = levelOf(r.id) === level;
                  const belegt = level === LEVEL_TOP && topPick != null && topPick.id !== r.id;
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={active}
                      onClick={() => choose(r.id, level)}
                      className={`rounded-md border px-3 py-1.5 ${
                        active ? "border-accent bg-accent text-white" : "border-line"
                      } ${belegt ? "opacity-40" : ""}`}
                    >
                      <span aria-hidden="true">{emoji}</span> {label}
                    </button>
                  );
                })}
              </div>
              {topPick != null && topPick.id !== r.id && levelOf(r.id) !== LEVEL_TOP && (
                <p className="mt-2 text-xs text-muted">
                  🔥 liegt gerade auf &bdquo;{topPick.title}&ldquo; &mdash; hier zu wählen verschiebt es hierher.
                </p>
              )}
            </li>
          ))}
          {rounds.length === 0 && (
            <li className="text-sm text-muted">Noch keine Runden eingetragen — schau gleich nochmal.</li>
          )}
        </ul>

        <button
          type="submit"
          disabled={!playerName.trim() || rounds.length === 0}
          className="w-fit rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Abschicken
        </button>
      </form>
    </div>
  );
}
