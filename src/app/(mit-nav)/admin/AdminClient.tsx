"use client";

import { useEffect, useState } from "react";
import Bestaetigung from "@/components/Bestaetigung";
import Fehlerhinweis from "@/components/Fehlerhinweis";
import Tagesanzeige from "@/components/Tagesanzeige";
import { dataStore } from "@/lib/dataStore";
import {
  einreichungenText,
  kennzahlen as berechneKennzahlen,
  levelVon,
  type Auslosung,
  type Kennzahlen,
} from "@/lib/protokoll";
import { LEVELS, LEVEL_STANDARD, type Assignment, type PlayerEntry, type Round } from "@/lib/types";

type RundenFelder = { dmName: string; title: string; vibe: string; capacity: number };

export default function AdminClient() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Text der 409-Rueckfrage beim Festlegen; `null` = keine offen. */
  const [veraltet, setVeraltet] = useState<string | null>(null);
  const [tagInfo, setTagInfo] = useState<{ name: string; tag: number; tage: number } | null>(null);
  /** Ausgeloste, aber noch nicht festgelegte Auslosung. Steht nur im Speicher. */
  const [vorschau, setVorschau] = useState<
    { auslosung: Auslosung; kennzahlen: Kennzahlen; protokoll: string } | null
  >(null);

  async function refresh() {
    setTagInfo(await (await fetch("/api/wochenende")).json());
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
      if (daten.veraltet) setVeraltet(daten.fehler);
      return;
    }

    setVeraltet(null);
    setVorschau(null);
    await refresh();
  }

  /** Den festgelegten Lauf zum Bearbeiten laden. Ergebnis wird ein neuer Lauf. */
  async function handleKorrigieren() {
    setFehler(null);
    const res = await fetch("/api/matching/aktuell");
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Ergebnis konnte nicht geladen werden (${res.status}).`);
      return;
    }
    setVorschau(await res.json());
  }

  /**
   * Jemanden umsetzen. Das erhaltene Level wird dabei aus der Angabe der Person
   * neu berechnet — sonst saehe eine Handkorrektur in der Statistik besser aus
   * als sie war. `commit` rechnet es serverseitig ohnehin nach.
   */
  function handleUmsetzen(playerId: number, roundId: number | null) {
    setVorschau((v) => {
      if (!v) return v;
      const person = v.auslosung.eingabestand.spieler.find((p) => p.id === playerId);
      if (!person) return v;

      if (roundId != null) {
        const runde = v.auslosung.eingabestand.runden.find((r) => r.id === roundId);
        const belegt = v.auslosung.zuordnungen.filter((z) => z.roundId === roundId).length;
        if (runde && belegt >= runde.capacity) {
          setFehler(
            `„${runde.title}" ist mit ${belegt} von ${runde.capacity} voll. ` +
              `Erst die Platzzahl erhöhen, dann umsetzen.`,
          );
          return v;
        }
      }

      const auslosung: Auslosung = {
        ...v.auslosung,
        konfiguration: { ...v.auslosung.konfiguration, manuellKorrigiert: true },
        zuordnungen: v.auslosung.zuordnungen.map((z) =>
          z.playerId === playerId
            ? {
                ...z,
                roundId,
                receivedLevel: roundId == null ? null : (levelVon(person, roundId) as never),
              }
            : z,
        ),
      };
      setFehler(null);
      return { ...v, auslosung, kennzahlen: berechneKennzahlen(auslosung) };
    });
  }

  function speichern(text: string, praefix: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `${praefix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    // Erst spaeter freigeben: direkt nach dem Klick ist ein Wettlauf mit dem
    // Browser, der den Download noch anstossen muss. Ausgerechnet beim
    // Papier-Notausgang will man den nicht.
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  /** Der Stand VOR dem Auslosen — Papier-Notausgang fuer die Wuensche. */
  function handleEinreichungen() {
    speichern(einreichungenText(rounds, entries), "einreichungen");
  }

  function handleProtokoll() {
    if (vorschau) speichern(vorschau.protokoll, "auslosung");
  }

  /** Protokoll des festgelegten Laufs — aus dessen eigenem Schnappschuss. */
  async function handleProtokollFestgelegt() {
    setFehler(null);
    const res = await fetch("/api/matching/protokoll");
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Protokoll konnte nicht geladen werden (${res.status}).`);
      return;
    }
    speichern((await res.json()).protokoll, "auslosung");
  }

  async function handleDelete(id: number) {
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

  /**
   * Eine Runde aendern. Aendert sich die Platzzahl, passt ein bereits
   * festgelegter Lauf nicht mehr dazu — deshalb der Hinweis, neu auszulosen.
   */
  async function handleRunde(id: number, felder: RundenFelder) {
    setFehler(null);
    const res = await fetch(`/api/rounds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(felder),
    });
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Runde konnte nicht geändert werden (${res.status}).`);
      return false;
    }
    setVorschau(null);
    await refresh();
    return true;
  }

  /** Wochenende benennen und die geplante Tagesanzahl setzen. */
  async function handleWochenende(name: string, tage: number) {
    setFehler(null);
    const res = await fetch("/api/wochenende", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tage }),
    });
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Wochenende konnte nicht gespeichert werden (${res.status}).`);
      return;
    }
    window.location.reload();
  }

  /** Naechster Spieltag. Runden und Einreichungen fangen dort bei null an. */
  async function handleNeuerTag() {
    setFehler(null);
    const res = await fetch("/api/wochenende/tag", { method: "POST" });
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Tag konnte nicht angelegt werden (${res.status}).`);
      return;
    }
    window.location.reload();
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.reload();
  }

  async function handleReset() {
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
          <Tagesanzeige />
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
          <Bestaetigung
            knopf="Alles zurücksetzen"
            frage={
              "Runden, Spielende und Ergebnisse dieses Tages werden gelöscht.\n" +
              "Das Wochenende und das Passwort bleiben."
            }
            jaText="Ja, löschen"
            onJa={handleReset}
            className="rounded-md border border-red-700 px-3 py-1.5 text-sm text-red-700 hover:bg-red-700/10"
          />
          <button onClick={handleLogout} className="text-sm text-muted hover:text-foreground">
            Abmelden
          </button>
        </div>
      </div>

      <Fehlerhinweis text={fehler} />

      {veraltet && (
        <div className="rounded-md border border-accent bg-card p-3 text-sm" role="alertdialog">
          <p className="whitespace-pre-line">{veraltet}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleFestlegen(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Trotzdem festlegen
            </button>
            <button
              onClick={() => {
                setVeraltet(null);
                handleAuslosen();
              }}
              className="rounded-md border border-line px-4 py-2 text-sm"
            >
              Neu auslosen
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleAuslosen}
        disabled={rounds.length === 0 || entries.length === 0}
        className={
          assignments && !vorschau
            ? "w-fit rounded-md border border-line px-4 py-2 text-sm disabled:opacity-40"
            : "w-fit rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-40"
        }
      >
        {assignments || vorschau ? "Neu auslosen" : "Auslosen"}
      </button>

      {entries.length > 0 && (
        <button
          onClick={handleEinreichungen}
          className="w-fit rounded-md border border-line px-4 py-2 text-sm"
        >
          Einreichungen sichern
        </button>
      )}

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

          <p className="mt-4 text-xs text-muted">
            Darunter zum Gegenlesen — und zum Umsetzen einzelner Personen.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {vorschau.auslosung.eingabestand.runden.map((runde) => {
              const sitzend = vorschau.auslosung.zuordnungen.filter((z) => z.roundId === runde.id);
              return (
                <div key={runde.id} className="rounded-md border border-line p-3 text-sm">
                  <p className="font-medium">
                    {runde.title} — Leitung {runde.dmName} ({sitzend.length}/{runde.capacity})
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {sitzend.map((z) => (
                      <li key={z.playerId} className="flex items-center justify-between gap-2">
                        <span className="text-muted">
                          {vorschau.auslosung.eingabestand.spieler.find((p) => p.id === z.playerId)
                            ?.playerName ?? "?"}
                        </span>
                        <select
                          value={z.roundId ?? ""}
                          onChange={(e) =>
                            handleUmsetzen(z.playerId, e.target.value === "" ? null : Number(e.target.value))
                          }
                          aria-label="Umsetzen"
                          className="rounded-md border border-line bg-card px-2 py-1 text-xs"
                        >
                          {vorschau.auslosung.eingabestand.runden.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                          <option value="">ohne Platz</option>
                        </select>
                      </li>
                    ))}
                    {sitzend.length === 0 && <li className="italic text-muted">leer</li>}
                  </ul>
                </div>
              );
            })}
          </div>

          {vorschau.auslosung.zuordnungen.some((z) => z.roundId == null) && (
            <div className="mt-3 rounded-md border border-red-700/40 p-3 text-sm">
              <p className="font-medium">Ohne Platz</p>
              <ul className="mt-2 flex flex-col gap-1">
                {vorschau.auslosung.zuordnungen
                  .filter((z) => z.roundId == null)
                  .map((z) => (
                    <li key={z.playerId} className="flex items-center justify-between gap-2">
                      <span className="text-muted">
                        {vorschau.auslosung.eingabestand.spieler.find((p) => p.id === z.playerId)
                          ?.playerName ?? "?"}
                      </span>
                      <select
                        value=""
                        onChange={(e) =>
                          e.target.value !== "" && handleUmsetzen(z.playerId, Number(e.target.value))
                        }
                        aria-label="Einsetzen"
                        className="rounded-md border border-line bg-card px-2 py-1 text-xs"
                      >
                        <option value="">ohne Platz</option>
                        {vorschau.auslosung.eingabestand.runden.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
              </ul>
            </div>
          )}


        </div>
      )}

      {assignments && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-accent">Ergebnis — festgelegt</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleProtokollFestgelegt}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                Protokoll herunterladen
              </button>
              <button
                onClick={handleKorrigieren}
                className="rounded-md border border-line px-4 py-2 text-sm"
              >
                Von Hand ändern
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">
            Das gilt. &bdquo;Neu auslosen&ldquo; oben erzeugt ein anderes Ergebnis und ersetzt
            dieses.
          </p>

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

      {tagInfo && (
      <form
        key={`${tagInfo.name}-${tagInfo.tage}`}
        onSubmit={(e) => {
          e.preventDefault();
          const daten = new FormData(e.currentTarget);
          handleWochenende(String(daten.get("name") ?? ""), Number(daten.get("tage")));
        }}
        className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-card p-3 text-sm"
      >
        <label className="flex flex-col gap-1">
          Wochenende
          <input
            name="name"
            defaultValue={tagInfo?.name ?? ""}
            placeholder="z. B. Novemberwochenende"
            className="rounded-md border border-line bg-card px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Tage
          <input
            name="tage"
            type="number"
            min={tagInfo?.tag ?? 1}
            max={7}
            defaultValue={tagInfo?.tage ?? 1}
            className="w-16 rounded-md border border-line bg-card px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded-md border border-line px-3 py-1.5">
          Speichern
        </button>
        <p className="w-full text-xs text-muted">
          Es gibt genau ein Wochenende. Name und Tagesanzahl lassen sich ändern —
          weniger Tage als bereits angelegt nicht.
        </p>
      </form>
      )}

      {assignments && !vorschau && tagInfo && tagInfo.tag < tagInfo.tage && (
        <div className="rounded-md border border-accent/40 bg-card p-4">
          <p className="font-medium">Tag {tagInfo.tag} ist ausgelost</p>
          <p className="mt-1 text-sm text-muted">
            Lade vorher Protokoll und Einreichungen herunter — nach dem Wechsel
            zeigt die App nur noch Tag {tagInfo.tag + 1}.
          </p>
          <div className="mt-3">
            <Bestaetigung
              knopf={`Tag ${tagInfo.tag + 1} von ${tagInfo.tage} beginnen`}
              frage={
                `Tag ${tagInfo.tag} bleibt gespeichert, ist danach aber nicht mehr zu sehen — ` +
                "die App zeigt immer den neuesten.\n" +
                "Protokoll und Einreichungen also vorher herunterladen.\n\n" +
                "Der neue Tag fängt bei null an: keine Runden, keine Einreichungen."
              }
              jaText="Ja, nächsten Tag beginnen"
              onJa={handleNeuerTag}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-accent">Runden</h2>
          {assignments && (
            <p className="mt-1 text-xs text-muted">
              Wird die Platzzahl geändert, passt das festgelegte Ergebnis nicht
              mehr dazu — dann neu auslosen.
            </p>
          )}
          <ul className="mt-2 flex flex-col gap-2">
            {rounds.map((r) => (
              <RundenZeile key={r.id} runde={r} onSpeichern={handleRunde} />
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
                <Bestaetigung
                  knopf="entfernen"
                  frage=""
                  jaText="wirklich"
                  kompakt
                  onJa={() => handleDelete(e.id)}
                  className="shrink-0 text-red-700 hover:text-red-800"
                />
              </li>
            ))}
            {entries.length === 0 && <li className="text-sm text-muted">Noch nichts.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Eine Runde in der Liste, wahlweise als Anzeige oder als Formular.
 *
 * Bearbeitet wird auf Knopfdruck und nicht dauernd: die Liste ist im Betrieb
 * vor allem zum Nachsehen da, und ein Feld, in das man aus Versehen tippt,
 * aendert sonst den Tisch von jemand anderem.
 *
 * Der Entwurf liegt in lokalem Zustand und wird erst beim Speichern
 * uebertragen — abbrechen stellt deshalb wirklich den alten Stand her.
 */
function RundenZeile({
  runde,
  onSpeichern,
}: {
  runde: Round;
  onSpeichern: (id: number, felder: RundenFelder) => Promise<boolean>;
}) {
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState<RundenFelder>({
    dmName: runde.dmName,
    title: runde.title,
    vibe: runde.vibe,
    capacity: runde.capacity,
  });

  function bearbeiten() {
    // Beim Oeffnen frisch aus der Runde fuellen: sonst steht nach einem
    // Abbrechen und erneutem Oeffnen der verworfene Entwurf wieder da.
    setEntwurf({
      dmName: runde.dmName,
      title: runde.title,
      vibe: runde.vibe,
      capacity: runde.capacity,
    });
    setOffen(true);
  }

  if (!offen) {
    return (
      <li className="rounded-md border border-line bg-card p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div>
              {runde.title} — Leitung {runde.dmName}
            </div>
            {runde.vibe && <p className="mt-1 text-xs text-muted">{runde.vibe}</p>}
            <p className="mt-1 text-xs text-muted">{runde.capacity} Plätze</p>
          </div>
          <button onClick={bearbeiten} className="shrink-0 text-accent hover:underline">
            bearbeiten
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-accent bg-card p-3 text-sm">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSpeichern(runde.id, entwurf)) setOffen(false);
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1">
          Titel
          <input
            value={entwurf.title}
            onChange={(e) => setEntwurf({ ...entwurf, title: e.target.value })}
            className="rounded-md border border-line bg-card px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Leitung
          <input
            value={entwurf.dmName}
            onChange={(e) => setEntwurf({ ...entwurf, dmName: e.target.value })}
            className="rounded-md border border-line bg-card px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Stimmung
          <textarea
            value={entwurf.vibe}
            rows={2}
            onChange={(e) => setEntwurf({ ...entwurf, vibe: e.target.value })}
            className="rounded-md border border-line bg-card px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          Plätze
          <input
            type="number"
            min={1}
            max={20}
            value={entwurf.capacity}
            onChange={(e) => setEntwurf({ ...entwurf, capacity: Number(e.target.value) })}
            className="w-16 rounded-md border border-line bg-card px-2 py-1"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={() => setOffen(false)}
            className="rounded-md border border-line px-3 py-1.5 text-sm"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </li>
  );
}
