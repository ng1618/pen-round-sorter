"use client";

import { useEffect, useState } from "react";
import Fehlerhinweis from "@/components/Fehlerhinweis";
import { dataStore } from "@/lib/dataStore";
import type { Auslosung, Kennzahlen } from "@/lib/protokoll";
import { LEVELS, LEVEL_STANDARD, type Assignment, type PlayerEntry, type Round } from "@/lib/types";

export default function AdminClient() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Ausgeloste, aber noch nicht festgelegte Auslosung. Steht nur im Speicher. */
  const [vorschau, setVorschau] = useState<
    { auslosung: Auslosung; kennzahlen: Kennzahlen; protokoll: string } | null
  >(null);

  async function refresh() {
    setRounds(await dataStore.listRounds());
    setEntries(await dataStore.listEntries());
    setAssignments(await dataStore.getAssignments());
  }

  useEffect(() => {
    // Als eigene async-Funktion, nicht `refresh().catch(...)`: sonst beanstandet
    // der react-hooks-Regelsatz einen setState-Aufruf direkt im Effekt.
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        setFehler(
          `Daten konnten nicht geladen werden: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    })();
  }, []);

  /**
   * Auslosen schreibt nichts. Der Schnappschuss entsteht dabei auf dem Server,
   * nicht erst beim Festlegen — sonst passt er nicht zu dem Ergebnis, das hier
   * auf dem Schirm steht.
   */
  async function handleAuslosen() {
    setFehler(null);
    const res = await fetch("/api/matching/preview", { method: "POST" });
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Auslosen fehlgeschlagen (${res.status}).`);
      return;
    }
    setVorschau(await res.json());
  }

  /** Erst hier entsteht eine Zeile. Verworfene Wuerfe hat es nie gegeben. */
  async function handleFestlegen(trotzdem = false) {
    if (!vorschau) return;
    setFehler(null);

    const res = await fetch("/api/matching/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auslosung: vorschau.auslosung, trotzdem }),
    });

    if (!res.ok) {
      const daten = await res.json().catch(() => ({}));
      setFehler(daten.fehler ?? `Festlegen fehlgeschlagen (${res.status}).`);
      // Bei 409 hat sich der Stand bewegt — der Wirt entscheidet, nicht die App.
      if (daten.veraltet && confirm(`${daten.fehler}

Trotzdem festlegen?`)) {
        await handleFestlegen(true);
      }
      return;
    }

    setVorschau(null);
    await refresh();
  }

  function handleProtokoll() {
    if (!vorschau) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([vorschau.protokoll], { type: "text/plain" }));
    a.download = `auslosung-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`${name} wirklich entfernen? Betrifft auch bereits festgelegte Ergebnisse.`)) return;
    setFehler(null);
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setFehler(
        res.status === 401
          ? "Nicht mehr angemeldet — die Sitzung ist abgelaufen. Seite neu laden und erneut anmelden."
          : `Entfernen fehlgeschlagen (${res.status}).`,
      );
      return;
    }
    await refresh();
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.reload();
  }

  async function handleReset() {
    if (!confirm("Das löscht alle Runden, Spielenden und Ergebnisse. Weiter?")) return;
    setFehler(null);
    try {
      await dataStore.resetAll();
      await refresh();
    } catch (e) {
      setFehler(`Zuruecksetzen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const entriesById = new Map(entries.map((e) => [e.id, e]));
  const roundsById = new Map(rounds.map((r) => [r.id, r]));

  // Jede Zeile in `spieler` ist ein Platzbedarf — auch wer sich nur angemeldet
  // und noch nichts gerankt hat. Genau deshalb ist die Anzeige dauerhaft
  // sichtbar und nicht erst beim Matching (Arbeitsdokument, Abschnitt 2).
  const capacity = rounds.reduce((sum, r) => sum + r.capacity, 0);
  const submittedCount = entries.filter((e) => e.submittedAt !== null).length;

  const byRound = new Map<number, Assignment[]>();
  const unassigned: Assignment[] = [];
  for (const a of assignments ?? []) {
    if (!a.roundId) {
      unassigned.push(a);
      continue;
    }
    byRound.set(a.roundId, [...(byRound.get(a.roundId) ?? []), a]);
  }

  // Kommt jetzt aus der Zuordnung selbst statt aus dem aktuellen Ranking
  // zurueckgerechnet zu werden — sonst aendert sich die Auswertung eines
  // festgelegten Laufs, sobald jemand neu rankt.
  const levelCounts = new Map<number, number>();
  for (const a of assignments ?? []) {
    if (a.receivedLevel == null) continue;
    levelCounts.set(a.receivedLevel, (levelCounts.get(a.receivedLevel) ?? 0) + 1);
  }
  // Hohes Level zuerst — 3 ist der Topwunsch.
  const levelBreakdown = LEVELS.map(({ level, emoji, label }) => ({
    label: `${emoji} ${label}`,
    count: levelCounts.get(level) ?? 0,
  })).filter((z) => z.count > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">🏰 Verwaltung</h1>
          <p className="mt-2 text-muted">
            {rounds.length} Runden · {capacity} Plätze · {entries.length} Spielende
            {" "}({submittedCount} haben eingereicht)
          </p>
          {capacity < entries.length && (
            <p className="mt-1 text-sm text-red-700">
              Unterdeckung: {entries.length - capacity} Spielende mehr als Plätze.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleReset}
            className="rounded-md border border-red-700 px-3 py-1.5 text-sm text-red-700 hover:bg-red-700/10"
          >
            Alles zurücksetzen
          </button>
          <button onClick={handleLogout} className="text-sm text-muted hover:text-foreground">
            Abmelden
          </button>
        </div>
      </div>

      <Fehlerhinweis text={fehler} />

      <button
        onClick={handleAuslosen}
        disabled={rounds.length === 0 || entries.length === 0}
        className="w-fit rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        {vorschau ? "Neu auslosen" : "Auslosen"}
      </button>

      {vorschau && (
        <div className="rounded-md border-2 border-accent bg-card p-4">
          <p className="font-medium text-accent">Vorschau — noch nicht festgelegt</p>
          <p className="mt-1 text-sm text-muted">
            Diese Auslosung steht nur im Speicher. Erst &bdquo;Festlegen&ldquo; schreibt
            sie in die Datenbank; &bdquo;Neu auslosen&ldquo; wirft sie weg.
          </p>

          <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
            {vorschau.kennzahlen.jeLevel.map((z) => (
              <li key={z.label}>
                {z.label}: {z.anzahl} Spielende
              </li>
            ))}
            {vorschau.kennzahlen.ohnePlatz > 0 && (
              <li className="text-red-700">Ohne Platz: {vorschau.kennzahlen.ohnePlatz}</li>
            )}
          </ul>

          <div className="mt-4 flex flex-col gap-3">
            {vorschau.auslosung.eingabestand.runden.map((runde) => {
              const sitzend = vorschau.auslosung.zuordnungen.filter((z) => z.roundId === runde.id);
              return (
                <div key={runde.id} className="rounded-md border border-line p-3 text-sm">
                  <p className="font-medium">
                    {runde.title} — Leitung {runde.dmName} ({sitzend.length}/{runde.capacity})
                  </p>
                  <p className="mt-1 text-muted">
                    {sitzend
                      .map(
                        (z) =>
                          vorschau.auslosung.eingabestand.spieler.find((p) => p.id === z.playerId)
                            ?.playerName ?? "?",
                      )
                      .join(", ")}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => handleFestlegen()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Festlegen
            </button>
            <button
              onClick={handleProtokoll}
              className="rounded-md border border-line px-4 py-2 text-sm"
            >
              Protokoll herunterladen
            </button>
            <button
              onClick={() => setVorschau(null)}
              className="rounded-md border border-line px-4 py-2 text-sm text-muted"
            >
              Verwerfen
            </button>
          </div>
        </div>
      )}

      {assignments && (
        <div>
          <h2 className="text-lg font-semibold text-accent">Ergebnis</h2>

          <div className="mt-3 rounded-md border border-accent/40 bg-card p-3 text-sm">
            <p className="font-medium">Wie gut ist es aufgegangen</p>
            <ul className="mt-2 flex flex-col gap-1 text-muted">
              {levelBreakdown.map((z) => (
                <li key={z.label}>
                  {z.label}: {z.count} Spielende
                </li>
              ))}
              {unassigned.length > 0 && (
                <li>
                  Ohne Platz: {unassigned.length} Spielende
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
                    {round.title} — Leitung {round.dmName} ({seated.length}/{round.capacity})
                  </p>
                  <ul className="mt-2 list-inside list-disc text-muted">
                    {seated.map((a) => (
                      <li key={a.playerId}>{entriesById.get(a.playerId)?.playerName}</li>
                    ))}
                    {seated.length === 0 && <li className="list-none italic">leer</li>}
                  </ul>
                </div>
              );
            })}

            {unassigned.length > 0 && (
              <div className="rounded-md border border-red-700/40 bg-card p-3 text-sm">
                <p className="font-medium">Ohne Platz ({unassigned.length})</p>
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
          <h2 className="text-sm font-semibold text-accent">Runden</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {rounds.map((r) => (
              <li key={r.id} className="rounded-md border border-line bg-card p-3 text-sm">
                {r.title} — Leitung {r.dmName} — {r.capacity} Plätze
              </li>
            ))}
            {rounds.length === 0 && <li className="text-sm text-muted">Noch nichts.</li>}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-accent">Spielende</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-md border border-line bg-card p-3 text-sm"
              >
                <span>
                {e.playerName}
                {e.submittedAt === null && <span className="text-muted"> — nichts eingereicht</span>}
                {e.preferences.length > 0 && (
                  <span className="text-muted">
                    {" — "}
                    {e.preferences
                      .filter((p) => p.level !== LEVEL_STANDARD)
                      .sort((a, b) => b.level - a.level)
                      .map(
                        (p) =>
                          `${LEVELS.find((l) => l.level === p.level)?.emoji ?? ""} ${
                            roundsById.get(p.roundId)?.title ?? "?"
                          }`,
                      )
                      .join(" · ")}
                  </span>
                )}
                </span>
                <button
                  onClick={() => handleDelete(e.id, e.playerName)}
                  className="shrink-0 text-red-700 hover:text-red-800"
                  aria-label={`${e.playerName} entfernen`}
                >
                  entfernen
                </button>
              </li>
            ))}
            {entries.length === 0 && <li className="text-sm text-muted">Noch nichts.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
