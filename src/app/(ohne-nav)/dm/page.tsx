"use client";

import { useEffect, useState } from "react";
import Fehlerhinweis from "@/components/Fehlerhinweis";
import { dataStore } from "@/lib/dataStore";
import type { Round } from "@/lib/types";

export default function DmPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [dmName, setDmName] = useState("");
  const [title, setTitle] = useState("");
  const [vibe, setVibe] = useState("");
  const [capacity, setCapacity] = useState(4);
  /** Nach dem Absenden die eingetragene Runde — dient zugleich als Gegenlesen. */
  const [eingetragen, setEingetragen] = useState<Round | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    dataStore
      .listRounds()
      .then(setRounds)
      .catch((e) => setFehler(`Runden konnten nicht geladen werden: ${e instanceof Error ? e.message : String(e)}`));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dmName.trim() || !title.trim() || capacity < 1) return;

    setFehler(null);
    let angelegt: Round;
    try {
      angelegt = await dataStore.addRound({
        dmName: dmName.trim(),
        title: title.trim(),
        vibe: vibe.trim(),
        capacity,
      });
      setRounds(await dataStore.listRounds());
    } catch (e) {
      setFehler(`Runde konnte nicht eingetragen werden: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    setTitle("");
    setVibe("");
    setCapacity(4);
    setEingetragen(angelegt);
  }

  /**
   * Nach dem Absenden verschwindet das Formular, wie auf /rank. Es stehen zu
   * lassen sah aus, als waere nichts passiert — und laedt dazu ein, dieselbe
   * Runde ein zweites Mal einzutragen. Die Runde wird dabei angezeigt, weil
   * Bearbeiten nicht vorgesehen ist: Gegenlesen ist das Einzige, was gegen
   * einen Tippfehler hilft.
   */
  if (eingetragen) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">🗡️ Eingetragen</h1>
          <p className="mt-2 text-muted">
            Deine Runde steht. Die Mitspielenden sehen sie ab sofort auf ihrer
            Wunschliste.
          </p>
        </div>

        <div className="rounded-md border border-accent/40 bg-card p-4 text-sm">
          <p className="font-medium">{eingetragen.title}</p>
          <p className="mt-1 text-muted">
            Leitung {eingetragen.dmName} · {eingetragen.capacity} Plätze
          </p>
          {eingetragen.vibe && <p className="mt-2 text-muted">{eingetragen.vibe}</p>}
        </div>

        <p className="text-sm text-muted">
          Stimmt etwas nicht? Ändern geht hier nicht — sag dem Wirt Bescheid,
          bevor ausgelost wird.
        </p>

        <button
          className="w-fit rounded-md border border-line bg-card px-4 py-2 text-sm"
          onClick={() => setEingetragen(null)}
        >
          Noch eine Runde eintragen
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">🗡️ Runde eintragen</h1>
        <p className="mt-2 text-muted">
          Sag den Mitspielenden, was du leitest und wie viele Plätze frei sind.
        </p>
      </div>

      <Fehlerhinweis text={fehler} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <input
            className="rounded-md border border-line bg-card px-3 py-2"
            value={dmName}
            onChange={(e) => setDmName(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Titel der Runde
          <input
            className="rounded-md border border-line bg-card px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Der Fluch der versunkenen Burg"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Stimmung
          <textarea
            className="rounded-md border border-line bg-card px-3 py-2"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="Ton, System, was die Mitspielenden erwartet …"
            rows={3}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Plätze
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
          Runde eintragen
        </button>

      </form>

      <div>
        <h2 className="font-semibold text-accent">Angebotene Runden ({rounds.length})</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {rounds.map((r) => (
            <li key={r.id} className="rounded-md border border-line bg-card p-3 text-sm">
              <span className="font-medium">{r.title}</span> — Leitung {r.dmName} — {r.capacity} Plätze
              {r.vibe && <p className="mt-1 text-muted">{r.vibe}</p>}
            </li>
          ))}
          {rounds.length === 0 && <li className="text-sm text-muted">Noch keine Runden.</li>}
        </ul>
      </div>
    </div>
  );
}
