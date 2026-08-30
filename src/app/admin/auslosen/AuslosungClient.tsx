"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminUnterleiste from "@/components/AdminUnterleiste";
import Fehlerhinweis from "@/components/Fehlerhinweis";
import Kennzahlenliste from "@/components/Kennzahlenliste";
import RundenErgebnis from "@/components/RundenErgebnis";
import Tagesanzeige from "@/components/Tagesanzeige";
import { dataStore } from "@/lib/dataStore";
import {
  einreichungenText,
  kennzahlen as berechneKennzahlen,
  levelVerteilung,
  levelVon,
  protokollText,
  type Auslosung,
  type Kennzahlen,
} from "@/lib/protokoll";
import { tauschrunde } from "@/lib/tausch";
import type { Assignment, PlayerEntry, Round } from "@/lib/types";

/**
 * Die Auslosung als eigener Ablauf: auslosen → ansehen → festlegen → Ergebnis.
 *
 * Bis zum 30.08. stand das zwischen Einrichtung und Verwaltungslisten auf einem
 * einzigen Bildschirm. Hier gilt Regel 4 aus dem Umbauplan: **vor und nach dem
 * Festlegen sieht die Seite unterschiedlich aus** — vorher ist „Auslosen" die
 * Haupthandlung, danach „Protokoll herunterladen".
 */
export default function AuslosungClient() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Ergebnis der letzten Tauschrunde, `null` = noch keine gelaufen. */
  const [tausch, setTausch] = useState<string | null>(null);
  /** Text der 409-Rueckfrage beim Festlegen; `null` = keine offen. */
  const [veraltet, setVeraltet] = useState<string | null>(null);
  /** Ausgeloste, aber noch nicht festgelegte Auslosung. Steht nur im Speicher. */
  const [vorschau, setVorschau] = useState<
    { auslosung: Auslosung; kennzahlen: Kennzahlen } | null
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
    setTausch(null);
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
    setTausch(null);
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
   *
   * **Volle Runden werden nicht mehr abgelehnt.** Bis zum 30.08. verweigerte
   * das Umsetzen jede Bewegung in einen vollen Tisch — bei 15 Personen auf 15
   * Plaetzen, also der geplanten Aufstellung, war damit *jede* Handkorrektur
   * blockiert. Jetzt gilt: umsetzen darf man immer, die Ueberbelegung wird
   * **markiert**, und **Festlegen** ist gesperrt, solange eine besteht. Der
   * Riegel sitzt damit dort, wo etwas Bleibendes entsteht — und serverseitig
   * prueft `commit` es ohnehin noch einmal.
   */
  function handleUmsetzen(playerId: number, roundId: number | null) {
    setVorschau((v) => {
      if (!v) return v;
      const person = v.auslosung.eingabestand.spieler.find((p) => p.id === playerId);
      if (!person) return v;

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

  /**
   * Ringtaeusche suchen und vollziehen (Top Trading Cycles).
   *
   * Findet nach einer frischen Auslosung nichts — die ist bereits
   * verbesserungsfrei, und das ist die Bestaetigung, nicht ein Mangel. Ergiebig
   * wird der Schritt, sobald von Hand geschoben oder nachtraeglich gesetzt
   * wurde: Ringe ueber drei oder mehr Personen sieht man dann nicht mehr.
   */
  function handleTausch() {
    if (!vorschau) return;
    setFehler(null);

    const { spieler } = vorschau.auslosung.eingabestand;
    const { zuordnungen, ringe } = tauschrunde(spieler, vorschau.auslosung.zuordnungen);

    if (ringe.length === 0) {
      setTausch(
        "Nichts zu tauschen — es gibt keinen Ringtausch, bei dem alle Beteiligten " +
          "besser dastuenden.",
      );
      return;
    }

    const name = (id: number) => spieler.find((p) => p.id === id)?.playerName ?? `#${id}`;
    const beschreibung = ringe
      .map((r) => r.personen.map(name).join(" → ") + " → " + name(r.personen[0]))
      .join(" · ");

    const auslosung: Auslosung = {
      ...vorschau.auslosung,
      konfiguration: { ...vorschau.auslosung.konfiguration, tauschrunden: ringe.length },
      zuordnungen,
    };
    setVorschau({ ...vorschau, auslosung, kennzahlen: berechneKennzahlen(auslosung) });
    setTausch(
      `${ringe.length} Ringtausch${ringe.length === 1 ? "" : "e"} vollzogen: ${beschreibung}. ` +
        "Niemand steht schlechter da als vorher, mindestens einer besser — " +
        "und die Belegung jeder Runde ist unverändert.",
    );
  }

  /**
   * Platzzahl waehrend der Auslosung aendern — in Ruecksprache mit der Leitung.
   * Der Fall: jemand ist wirklich ungluecklich, es gibt keine gute Loesung, und
   * die Leitung sagt "ach komm, dann machen wir sechs".
   *
   * Geaendert wird **beides**: die Runde in der Datenbank und der Schnappschuss
   * der Vorschau. Nur den Schnappschuss zu aendern hiesse, dass der gespeicherte
   * Lauf eine Platzzahl behauptet, die die Runde nie hatte; nur die Datenbank zu
   * aendern hiesse, dass die Vorschau weiter mit der alten rechnet und das
   * Festlegen daran scheitert.
   *
   * Dass die Zahl **nachtraeglich** geaendert wurde, wandert in die
   * Konfiguration und von dort ins Protokoll. Sonst sieht der Ausdruck aus, als
   * haette der Tisch von Anfang an sechs Plaetze gehabt.
   */
  async function handlePlaetze(rundenId: number, plaetze: number) {
    if (!vorschau) return;
    setFehler(null);

    const runde = vorschau.auslosung.eingabestand.runden.find((r) => r.id === rundenId);
    if (!runde) return;

    const res = await fetch(`/api/rounds/${rundenId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dmName: runde.dmName,
        title: runde.title,
        vibe: runde.vibe,
        capacity: plaetze,
      }),
    });
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Platzzahl konnte nicht geändert werden (${res.status}).`);
      return;
    }

    const bisher = (vorschau.auslosung.konfiguration.plaetzeNachtraeglich ?? []) as Array<{
      titel: string;
      von: number;
      auf: number;
    }>;
    const auslosung: Auslosung = {
      ...vorschau.auslosung,
      konfiguration: {
        ...vorschau.auslosung.konfiguration,
        plaetzeNachtraeglich: [
          ...bisher,
          { titel: runde.title, von: runde.capacity, auf: plaetze },
        ],
      },
      eingabestand: {
        ...vorschau.auslosung.eingabestand,
        runden: vorschau.auslosung.eingabestand.runden.map((r) =>
          r.id === rundenId ? { ...r, capacity: plaetze } : r,
        ),
      },
    };
    setVorschau({ ...vorschau, auslosung, kennzahlen: berechneKennzahlen(auslosung) });
    setRounds(await dataStore.listRounds());
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

  /**
   * Das Protokoll der Vorschau wird **beim Herunterladen** aus dem aktuellen
   * Stand erzeugt, nicht beim Auslosen.
   *
   * Bis zum 30.08. kam hier der Text, den der Server beim Auslosen mitgeliefert
   * hatte. Jede Handkorrektur, jeder Ringtausch und jede nachtraeglich
   * geaenderte Platzzahl fehlten darin — der Ausdruck zeigte das Ergebnis des
   * ersten Wurfs, waehrend am Tisch etwas anderes galt. Ausgerechnet das Blatt,
   * das die Nachvollziehbarkeit tragen soll.
   *
   * `protokollText` ist eine reine Funktion und laeuft deshalb hier genauso wie
   * auf dem Server — es gibt weiterhin nur eine Auswertung.
   */
  function handleProtokoll() {
    if (vorschau) speichern(protokollText(vorschau.auslosung), "auslosung");
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

  /**
   * Welche Runden sind ueberbelegt? Aus der Vorschau abgeleitet und nicht
   * mitgefuehrt, damit die Anzeige nach jedem Umsetzen von selbst stimmt.
   */
  const ueberbelegt = (vorschau?.auslosung.eingabestand.runden ?? [])
    .map((runde) => ({
      runde,
      belegt: (vorschau?.auslosung.zuordnungen ?? []).filter((z) => z.roundId === runde.id).length,
    }))
    .filter(({ runde, belegt }) => belegt > runde.capacity);

  const nichtsDa = rounds.length === 0 || entries.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <AdminUnterleiste />

      <div>
        <h1 className="text-2xl font-bold">🎲 Auslosung</h1>
        <Tagesanzeige />
      </div>

      <Fehlerhinweis text={fehler} />

      {veraltet && (
        <div className="rounded-md border border-accent bg-card p-3 text-sm" role="alertdialog">
          <p className="whitespace-pre-line">{veraltet}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleFestlegen(true)}
              className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Trotzdem festlegen
            </button>
            <button
              onClick={() => {
                setVeraltet(null);
                handleAuslosen();
              }}
              className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
            >
              Neu auslosen
            </button>
          </div>
        </div>
      )}

      {nichtsDa && (
        <p className="rounded-md border border-line bg-card p-4 text-sm text-muted">
          Ohne Tische oder ohne Gäste lässt sich nichts auslosen.{" "}
          <Link href="/admin" className="text-accent underline">
            Zurück zum Tresen
          </Link>
          .
        </p>
      )}

      {/* Vor dem Festlegen ist Auslosen die Haupthandlung. Steht schon ein
          Ergebnis, wird sie zur Nebenhandlung — ein neuer Wurf ersetzt es. */}
      {!nichtsDa && !vorschau && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAuslosen}
            className={
              assignments
                ? "min-h-11 rounded-md border border-line px-4 py-2 text-sm"
                : "min-h-11 rounded-md bg-accent px-5 py-3 font-medium text-white"
            }
          >
            {assignments ? "Neu auslosen" : "Auslosen"}
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleEinreichungen}
              className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
            >
              Einreichungen sichern
            </button>
          )}
        </div>
      )}

      {vorschau && (
        <div className="rounded-md border-2 border-accent bg-card p-4">
          <p className="font-medium text-accent">Vorschau — noch nicht festgelegt</p>
          <p className="mt-1 text-sm text-muted">
            Diese Auslosung steht nur im Speicher. Erst &bdquo;Festlegen&ldquo; schreibt sie in
            die Datenbank; &bdquo;Verwerfen&ldquo; wirft sie weg.
          </p>

          <Kennzahlenliste
            className="mt-3"
            jeLevel={vorschau.kennzahlen.jeLevel}
            ohnePlatz={vorschau.kennzahlen.ohnePlatz}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => handleFestlegen()}
              disabled={ueberbelegt.length > 0}
              className="min-h-11 rounded-md bg-accent px-5 py-3 font-medium text-white disabled:opacity-40"
            >
              Festlegen
            </button>
            <button
              onClick={handleProtokoll}
              className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
            >
              Protokoll herunterladen
            </button>
            <button
              onClick={handleAuslosen}
              className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
            >
              Neu auslosen
            </button>
            <button
              onClick={handleTausch}
              className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
            >
              Ringtäusche suchen
            </button>
            <button
              onClick={() => {
                setTausch(null);
                setVorschau(null);
              }}
              className="min-h-11 rounded-md px-4 py-2 text-sm text-muted underline"
            >
              Verwerfen
            </button>
          </div>

          {tausch && (
            <p className="mt-3 rounded-md border border-line p-3 text-sm text-muted" role="status">
              {tausch}
            </p>
          )}

          {ueberbelegt.length > 0 && (
            <div className="mt-3 rounded-md border-2 border-red-700 p-3 text-sm" role="alert">
              <p className="font-medium text-red-700">
                Festlegen ist gesperrt: {ueberbelegt.length === 1 ? "eine Runde ist" : `${ueberbelegt.length} Runden sind`}{" "}
                überbelegt.
              </p>
              <ul className="mt-2 list-inside list-disc text-muted">
                {ueberbelegt.map(({ runde, belegt }) => (
                  <li key={runde.id}>
                    {runde.title}: {belegt} von {runde.capacity} — {belegt - runde.capacity} zu viel
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-muted">
                Entweder jemanden herausnehmen, die Platzzahl am Tresen erhöhen, oder
                &bdquo;Ringtäusche suchen&ldquo; — das tauscht, ohne die Belegung zu ändern.
              </p>
            </div>
          )}

          <p className="mt-4 text-xs text-muted">
            Darunter zum Gegenlesen — und zum Umsetzen einzelner Personen.
          </p>
          <div className="mt-3">
            <RundenErgebnis
              runden={vorschau.auslosung.eingabestand.runden}
              spieler={vorschau.auslosung.eingabestand.spieler}
              zuordnungen={vorschau.auslosung.zuordnungen}
              onUmsetzen={handleUmsetzen}
              onPlaetze={handlePlaetze}
            />
          </div>
        </div>
      )}

      {assignments && !vorschau && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-accent">Ergebnis — festgelegt</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleProtokollFestgelegt}
                className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                Protokoll herunterladen
              </button>
              <button
                onClick={handleKorrigieren}
                className="min-h-11 rounded-md border border-line px-4 py-2 text-sm"
              >
                Von Hand ändern
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">
            Das gilt. &bdquo;Neu auslosen&ldquo; erzeugt ein anderes Ergebnis und ersetzt dieses.
          </p>

          <div className="mt-3 rounded-md border border-accent/40 bg-card p-3">
            <p className="text-sm font-medium">Wie gut ist es aufgegangen</p>
            <Kennzahlenliste
              className="mt-2"
              jeLevel={levelVerteilung(assignments)}
              ohnePlatz={assignments.filter((a) => a.roundId == null).length}
            />
          </div>

          <div className="mt-4">
            <RundenErgebnis runden={rounds} spieler={entries} zuordnungen={assignments} />
          </div>
        </div>
      )}
    </div>
  );
}
