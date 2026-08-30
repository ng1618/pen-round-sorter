"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminUnterleiste from "@/components/AdminUnterleiste";
import Bestaetigung from "@/components/Bestaetigung";
import Fehlerhinweis from "@/components/Fehlerhinweis";
import Tagesanzeige from "@/components/Tagesanzeige";
import { dataStore } from "@/lib/dataStore";
import { LEVELS, LEVEL_STANDARD, type Assignment, type PlayerEntry, type Round } from "@/lib/types";

type RundenFelder = { dmName: string; title: string; vibe: string; capacity: number };
type TagInfo = { name: string; tag: number; tage: number };

/**
 * Der Tresen: Zustand des Tages auf einen Blick, dazu **eine** Haupthandlung.
 *
 * Regel 1 aus dem Umbauplan vom 30.08. — am Eventabend steht hier jemand mit
 * achtzehn wartenden Leuten. Was jetzt zu tun ist, muss man sehen und nicht
 * suchen. Alles Seltene (Einrichtung, Zurücksetzen) liegt auf den anderen
 * Reitern; die Auslosung selbst hat einen eigenen Ablauf.
 */
export default function TresenClient() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /**
   * Erst nach dem ersten Laden darf der Tresen behaupten, was zu tun ist.
   * Ohne das stand beim ersten Bild "Warten auf die Spielleitungen", auch
   * wenn drei Runden vorlagen — der Zustand kommt aus einem Effekt, das
   * Serverbild kennt ihn noch nicht.
   */
  const [geladen, setGeladen] = useState(false);

  async function refresh() {
    setTagInfo(await (await fetch("/api/wochenende")).json());
    setRounds(await dataStore.listRounds());
    setEntries(await dataStore.listEntries());
    setAssignments(await dataStore.getAssignments());
    setGeladen(true);
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
   * Eine Runde ändern. Ändert sich die Platzzahl, passt ein bereits
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
    await refresh();
    return true;
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

  /** Nächster Spieltag. Runden und Einreichungen fangen dort bei null an. */
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

  const roundsById = new Map(rounds.map((r) => [r.id, r]));

  // Jede Zeile in `spieler` ist ein Platzbedarf — auch wer sich nur angemeldet
  // und noch nichts gerankt hat. Genau deshalb ist die Anzeige dauerhaft
  // sichtbar und nicht erst beim Matching (Arbeitsdokument, Abschnitt 2).
  const capacity = rounds.reduce((sum, r) => sum + r.capacity, 0);
  const submittedCount = entries.filter((e) => e.submittedAt !== null).length;

  return (
    <div className="flex flex-col gap-8">
      <AdminUnterleiste />

      <div>
        <h1 className="text-2xl font-bold">🏰 Tresen</h1>
        <Tagesanzeige />
        <p className="mt-2 text-muted">
          {rounds.length} Runden · {capacity} Plätze · {entries.length} Spielende (
          {submittedCount} haben eingereicht)
        </p>
        {capacity < entries.length && (
          <p className="mt-1 text-sm text-red-700">
            Unterdeckung: {entries.length - capacity} Spielende mehr als Plätze.
          </p>
        )}
      </div>

      <Fehlerhinweis text={fehler} />

      {geladen ? (
      <NaechsterSchritt
        rounds={rounds}
        entries={entries}
        assignments={assignments}
        tagInfo={tagInfo}
        onNeuerTag={handleNeuerTag}
      />
      ) : (
        <p className="rounded-md border border-line bg-card p-4 text-sm text-muted">Lädt …</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-accent">Runden</h2>
          {assignments && (
            <p className="mt-1 text-xs text-muted">
              Wird die Platzzahl geändert, passt das festgelegte Ergebnis nicht mehr dazu — dann
              neu auslosen.
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
                  {e.submittedAt === null && (
                    <span className="text-muted"> — nichts eingereicht</span>
                  )}
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
 * Was jetzt dran ist — abgeleitet aus dem Zustand, nicht vom Menschen gesucht.
 *
 * Höchstens **ein** gefüllter Knopf je Bildschirm (Regel 2). Solange nichts zu
 * tun ist, steht hier kein Knopf, sondern der Grund dafür und der Weg zu den
 * QR-Codes — das ist dann nämlich wirklich der nächste Schritt.
 */
function NaechsterSchritt({
  rounds,
  entries,
  assignments,
  tagInfo,
  onNeuerTag,
}: {
  rounds: Round[];
  entries: PlayerEntry[];
  assignments: Assignment[] | null;
  tagInfo: TagInfo | null;
  onNeuerTag: () => void;
}) {
  const rahmen = "rounded-md border border-accent/40 bg-card p-4";
  const primaer = "inline-flex min-h-11 items-center rounded-md bg-accent px-5 py-3 font-medium text-white";
  const codes = (
    <Link href="/codes" className="text-sm text-accent underline">
      📱 Codes zum Scannen
    </Link>
  );

  if (rounds.length === 0) {
    return (
      <div className={rahmen}>
        <p className="font-medium">Warten auf die Spielleitungen</p>
        <p className="mt-1 text-sm text-muted">
          Noch keine Runde eingetragen. Zeig den Leitungen den Code für <code>/dm</code>.
        </p>
        <div className="mt-3">{codes}</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={rahmen}>
        <p className="font-medium">Warten auf die Wünsche</p>
        <p className="mt-1 text-sm text-muted">
          {rounds.length} Runden stehen, aber noch niemand hat eingereicht.
        </p>
        <div className="mt-3">{codes}</div>
      </div>
    );
  }

  if (!assignments) {
    return (
      <div className={rahmen}>
        <p className="font-medium">Bereit zum Auslosen</p>
        <p className="mt-1 text-sm text-muted">
          {entries.length} Spielende auf {rounds.reduce((s, r) => s + r.capacity, 0)} Plätze.
          Nachzügler können auch danach noch von Hand gesetzt werden.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link href="/admin/auslosen" className={primaer}>
            Auslosen
          </Link>
          {codes}
        </div>
      </div>
    );
  }

  const letzterTag = !tagInfo || tagInfo.tag >= tagInfo.tage;

  return (
    <div className="flex flex-col gap-4">
      <div className={rahmen}>
        <p className="font-medium">Tag {tagInfo?.tag ?? "?"} ist ausgelost</p>
        <p className="mt-1 text-sm text-muted">
          Das Ergebnis gilt. Dort gibt es auch das Protokoll zum Herunterladen.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link href="/admin/auslosen" className={primaer}>
            Ergebnis ansehen
          </Link>
          {codes}
        </div>
      </div>

      {!letzterTag && tagInfo && (
        <div className="rounded-md border border-line bg-card p-4">
          <p className="font-medium">Weiter zu Tag {tagInfo.tag + 1}</p>
          <p className="mt-1 text-sm text-muted">
            Lade vorher Protokoll und Einreichungen herunter — nach dem Wechsel zeigt die App nur
            noch Tag {tagInfo.tag + 1}.
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
              onJa={onNeuerTag}
              className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Eine Runde in der Liste, wahlweise als Anzeige oder als Formular.
 *
 * Bearbeitet wird auf Knopfdruck und nicht dauernd: die Liste ist im Betrieb
 * vor allem zum Nachsehen da, und ein Feld, in das man aus Versehen tippt,
 * ändert sonst den Tisch von jemand anderem.
 *
 * Der Entwurf liegt in lokalem Zustand und wird erst beim Speichern
 * übertragen — abbrechen stellt deshalb wirklich den alten Stand her.
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
    // Beim Öffnen frisch aus der Runde füllen: sonst steht nach einem
    // Abbrechen und erneutem Öffnen der verworfene Entwurf wieder da.
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
            className="min-h-11 rounded-md border border-line bg-card px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Leitung
          <input
            value={entwurf.dmName}
            onChange={(e) => setEntwurf({ ...entwurf, dmName: e.target.value })}
            className="min-h-11 rounded-md border border-line bg-card px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Stimmung
          <textarea
            value={entwurf.vibe}
            rows={2}
            onChange={(e) => setEntwurf({ ...entwurf, vibe: e.target.value })}
            className="rounded-md border border-line bg-card px-3 py-2"
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
            className="min-h-11 w-20 rounded-md border border-line bg-card px-3 py-2"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={() => setOffen(false)}
            className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </li>
  );
}
