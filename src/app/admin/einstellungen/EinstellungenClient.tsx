"use client";

import { useEffect, useState } from "react";
import AdminUnterleiste from "@/components/AdminUnterleiste";
import Fehlerhinweis from "@/components/Fehlerhinweis";
import type { Einstellungen } from "@/lib/types";

type TagInfo = { name: string; tag: number; tage: number };

/**
 * Ein zerstörender Knopf, der das Verwaltungspasswort noch einmal verlangt
 * (20.11.). Die Sitzung allein reicht nicht: am Tresen liegt ein Handy offen.
 */
function Zuruecksetzen({
  umfang,
  knopf,
  text,
}: {
  umfang: "tag" | "wochenende";
  knopf: string;
  text: React.ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    const res = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwort, umfang }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/admin";
      return;
    }
    const { fehler: meldung } = (await res?.json().catch(() => ({}))) ?? {};
    setFehler(meldung ?? "Zurücksetzen fehlgeschlagen.");
    setLaeuft(false);
  }

  return (
    <div className="flex max-w-prose flex-col gap-3 text-sm">
      <p className="text-muted">{text}</p>
      {!offen ? (
        <button
          onClick={() => setOffen(true)}
          className="min-h-11 w-fit rounded-md border border-red-700 px-4 py-2 text-red-700 hover:bg-red-700/10"
        >
          {knopf}
        </button>
      ) : (
        <form
          onSubmit={absenden}
          className="flex flex-col gap-3 rounded-md border border-red-700 bg-card p-3"
          role="alertdialog"
        >
          <label className="flex flex-col gap-1">
            Zur Sicherheit das Verwaltungspasswort
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              className="min-h-11 rounded-md border border-line bg-card px-3 py-2"
            />
          </label>
          {fehler && <p className="text-red-700">{fehler}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={laeuft || passwort.length === 0}
              className="min-h-11 rounded-md bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-40"
            >
              {knopf}
            </button>
            <button
              type="button"
              onClick={() => {
                setOffen(false);
                setPasswort("");
                setFehler(null);
              }}
              className="min-h-11 rounded-md border border-line px-4 py-2 text-muted"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Wochenende und Regeln — alles, was selten angefasst wird.
 *
 * Zwei Dinge folgen aus dem Umbauplan vom 30.08.:
 *
 * 1. **Die Einrichtung ist hier und nicht im Betriebsablauf.** Bis dahin stand
 *    das Formular zwischen Ergebnis und Tageswechsel; wer am Eventabend das
 *    Ergebnis las, scrollte durch die Einrichtung.
 * 2. **Zurücksetzen steht ganz unten**, nicht mehr oben rechts neben
 *    „Abmelden". Die zerstörendste Handlung gehört nicht an die prominenteste
 *    Stelle — Regel 3.
 *
 * Solange das Wochenende noch keinen Namen hat, rahmt die Seite dieselben
 * Felder als **Ersteinrichtung**. Das ist das Muster, das `AnmeldeFormular` mit
 * `ersteinrichtung` schon benutzt.
 */
export default function EinstellungenClient() {
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [regeln, setRegeln] = useState<Einstellungen | null>(null);

  async function laden() {
    setTagInfo(await (await fetch("/api/wochenende")).json());
    // Eigene Route, weil `/api/wochenende` offen ist: dass gerade das Optimum
    // laeuft, darf vor der Auslosung niemand wissen — es ist nicht
    // manipulationsfest.
    const res = await fetch("/api/einstellungen");
    if (res.ok) setRegeln(await res.json());
  }

  useEffect(() => {
    void (async () => {
      try {
        await laden();
      } catch (e) {
        setFehler(
          `Einstellungen konnten nicht geladen werden: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    })();
  }, []);

  async function handleWochenende(name: string, tage: number) {
    setFehler(null);
    setGespeichert(false);
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
    setGespeichert(true);
    await laden();
  }

  /** Verfahren und Schalter. Serverseitig geprueft, hier nur durchgereicht. */
  async function handleRegeln(teil: Partial<Einstellungen>) {
    setFehler(null);
    setGespeichert(false);
    const res = await fetch("/api/einstellungen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teil),
    });
    if (!res.ok) {
      const { fehler: text } = await res.json().catch(() => ({}));
      setFehler(text ?? `Einstellung konnte nicht gespeichert werden (${res.status}).`);
      return;
    }
    setRegeln(await res.json());
    setGespeichert(true);
  }

  if (!tagInfo) {
    return (
      <div className="flex flex-col gap-6">
        <AdminUnterleiste />
        <Fehlerhinweis text={fehler} />
        <p className="text-muted">Lädt …</p>
      </div>
    );
  }

  // Der Seed und `aktuellesWochenendeId()` legen notfalls ein Wochenende namens
  // „Spieleabend" an, damit die App auch ohne Einrichtung laeuft. Genau das ist
  // hier das Zeichen, dass noch niemand etwas eingerichtet hat.
  const ersteinrichtung = tagInfo.name.trim() === "" || tagInfo.name === "Spieleabend";

  return (
    <div className="flex flex-col gap-8">
      <AdminUnterleiste />

      <div>
        <h1 className="text-2xl font-bold">
          {ersteinrichtung ? "🕯️ Willkommen" : "⚙️ Einstellungen"}
        </h1>
        <p className="mt-2 text-muted">
          {ersteinrichtung
            ? "Leg zuerst das Wochenende an: wie es heißt und über wie viele Tage es geht."
            : "Was hier steht, gilt für das ganze Wochenende."}
        </p>
      </div>

      <Fehlerhinweis text={fehler} />

      <section>
        <h2 className="text-sm font-semibold text-accent">Wochenende</h2>
        <form
          key={`${tagInfo.name}-${tagInfo.tage}`}
          onSubmit={(e) => {
            e.preventDefault();
            const daten = new FormData(e.currentTarget);
            handleWochenende(String(daten.get("name") ?? ""), Number(daten.get("tage")));
          }}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-line bg-card p-4 text-sm"
        >
          <label className="flex flex-col gap-1">
            Name
            <input
              name="name"
              defaultValue={ersteinrichtung ? "" : tagInfo.name}
              placeholder="z. B. Novemberwochenende"
              className="min-h-11 rounded-md border border-line bg-card px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            Tage
            <input
              name="tage"
              type="number"
              min={tagInfo.tag}
              max={7}
              defaultValue={tagInfo.tage}
              className="min-h-11 w-20 rounded-md border border-line bg-card px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-md bg-accent px-5 py-2 font-medium text-white"
          >
            {ersteinrichtung ? "Wochenende anlegen" : "Speichern"}
          </button>

          {gespeichert && (
            <p className="w-full text-xs text-accent" role="status">
              Gespeichert.
            </p>
          )}
          <p className="w-full text-xs text-muted">
            Es gibt genau ein Wochenende. Name und Tagesanzahl lassen sich jederzeit ändern —
            weniger Tage als bereits angelegt nicht. Der Tageswechsel selbst steht am Tresen, weil
            er zum Ablauf gehört und nicht zur Einrichtung.
          </p>
        </form>
      </section>

      {regeln && (
        <section>
          <h2 className="text-sm font-semibold text-accent">Auslosung</h2>
          <div className="mt-2 flex flex-col gap-5 rounded-md border border-line bg-card p-4 text-sm">
            <fieldset>
              <legend className="font-medium">Verfahren</legend>

              <label className="mt-2 flex items-start gap-3">
                <input
                  type="radio"
                  name="verfahren"
                  checked={regeln.verfahren === "rsd"}
                  onChange={() => handleRegeln({ verfahren: "rsd" })}
                  className="mt-1"
                />
                <span>
                  <strong>Losverfahren</strong> — alle in zufälliger Reihenfolge, jede Person nimmt
                  den besten noch freien Tisch.
                  <span className="mt-1 block text-muted">
                    <strong>Manipulationsfest:</strong> ehrlich anzugeben, was man will, ist immer
                    der beste Zug. Deshalb die Vorgabe.
                  </span>
                </span>
              </label>

              <label className="mt-4 flex items-start gap-3">
                <input
                  type="radio"
                  name="verfahren"
                  checked={regeln.verfahren === "leximin"}
                  onChange={() => handleRegeln({ verfahren: "leximin" })}
                  className="mt-1"
                />
                <span>
                  <strong>Leximin</strong> — so wenige wie möglich bleiben ohne Platz, dann so
                  wenige wie möglich auf 😬, dann auf 🤷.
                  <span className="mt-1 block text-muted">
                    Fragt &bdquo;wie schlimm trifft es den, den es am härtesten trifft?&ldquo; Gemessen am
                    30.08.: im geplanten Normalfall <strong>identisch</strong> zum Losverfahren —
                    hilft erst, wenn es eng wird. Fällt eine Leitung aus (10 Plätze für 15), sind es
                    8,0 statt 6,2 erfüllte Topwünsche.
                  </span>
                  <span className="mt-1 block text-red-700">
                    Nicht manipulationsfest: wer weiß, dass es läuft, gewinnt mit unehrlichen
                    Angaben. Das Protokoll schreibt den Vorbehalt mit.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="border-t border-line pt-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={regeln.ausgleichUeberTage}
                  onChange={(e) => handleRegeln({ ausgleichUeberTage: e.target.checked })}
                  className="mt-1"
                  disabled
                />
                <span>
                  <strong>Ausgleich über die Tage</strong> — wer an einem früheren Tag seinen
                  Topwunsch nicht bekam, wird später früher gezogen.
                  <span className="mt-1 block text-muted">
                    Verschiebt nur die Reihenfolge; ein Anspruch auf den Wunschtisch ist es nicht.
                    Für dieses Wochenende bewusst nicht gebaut und deshalb abgeschaltet;
                    kommt frühestens nach dem Event.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </section>
      )}

      {/* Die zerstörendsten Handlungen ganz unten, hinter dem Passwort. */}
      {!ersteinrichtung && (
        <section className="mt-4 flex flex-col gap-6 border-t border-line pt-6">
          <h2 className="text-sm font-semibold text-red-700">Gefährliche Ecke</h2>

          <Zuruecksetzen
            umfang="tag"
            knopf={`Tag ${tagInfo.tag} zurücksetzen`}
            text={
              <>
                Runden, Spielende und Ergebnisse von <strong>Tag {tagInfo.tag}</strong> werden
                gelöscht, als wäre an diesem Tag nichts geschehen. <strong>Frühere Tage</strong>,
                das Passwort und die QR-Codes bleiben.
              </>
            }
          />

          <Zuruecksetzen
            umfang="wochenende"
            knopf="Wochenende nullen"
            text={
              <>
                <strong>Alle Tage</strong> werden geleert, danach steht das Wochenende wieder leer
                auf Tag 1. Name, Tagesanzahl, Regeln, Passwort und QR-Codes bleiben.
              </>
            }
          />
        </section>
      )}
    </div>
  );
}
