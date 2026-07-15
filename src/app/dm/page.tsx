"use client";

import { useEffect, useState } from "react";
import { dataStore } from "@/lib/dataStore";
import type { Round } from "@/lib/types";

export default function DmPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [dmName, setDmName] = useState("");
  const [title, setTitle] = useState("");
  const [vibe, setVibe] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dataStore.listRounds().then(setRounds);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dmName.trim() || !title.trim() || capacity < 1) return;

    await dataStore.addRound({
      dmName: dmName.trim(),
      title: title.trim(),
      vibe: vibe.trim(),
      capacity,
    });
    setRounds(await dataStore.listRounds());
    setTitle("");
    setVibe("");
    setCapacity(4);
    setSubmitted(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">🗡️ Submit a round</h1>
        <p className="mt-2 text-muted">
          Tell players what you&apos;re running and how many seats are open at your table.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            className="rounded-md border border-line bg-card px-3 py-2"
            value={dmName}
            onChange={(e) => setDmName(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Round title
          <input
            className="rounded-md border border-line bg-card px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Curse of the Sunken Keep"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Vibe
          <textarea
            className="rounded-md border border-line bg-card px-3 py-2"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="Tone, system, what players should expect..."
            rows={3}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Player capacity
          <input
            type="number"
            min={1}
            className="rounded-md border border-line bg-card px-3 py-2"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            required
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-md bg-accent px-4 py-2 font-medium text-white"
        >
          Submit round
        </button>

        {submitted && (
          <p className="text-sm text-green-700">Round submitted! You can add another one below.</p>
        )}
      </form>

      <div>
        <h2 className="font-semibold text-accent">Rounds on offer ({rounds.length})</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {rounds.map((r) => (
            <li key={r.id} className="rounded-md border border-line bg-card p-3 text-sm">
              <span className="font-medium">{r.title}</span> — DM {r.dmName} — cap{" "}
              {r.capacity}
              {r.vibe && <p className="mt-1 text-muted">{r.vibe}</p>}
            </li>
          ))}
          {rounds.length === 0 && <li className="text-sm text-muted">No rounds yet.</li>}
        </ul>
      </div>
    </div>
  );
}
