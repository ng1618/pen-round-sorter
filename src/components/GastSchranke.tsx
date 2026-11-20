"use client";

import { useCallback, useEffect, useState } from "react";

export type Zugang = {
  auslosungLaeuft: boolean;
  gastPasswortGesetzt: boolean;
  gastFrei: boolean;
  wirt: boolean;
};

/** Was darf dieses Geraet gerade? Liest `/api/zugang`. */
export function useZugang() {
  const [zugang, setZugang] = useState<Zugang | null>(null);
  const laden = useCallback(async () => {
    try {
      const res = await fetch("/api/zugang", { cache: "no-store" });
      if (res.ok) setZugang(await res.json());
    } catch {
      // Ohne Antwort bleibt die Seite benutzbar; der Server prueft ohnehin.
    }
  }, []);
  useEffect(() => {
    // Als eigene async-Funktion: sonst beanstandet der react-hooks-Regelsatz
    // einen setState-Aufruf direkt im Effekt.
    void (async () => {
      await laden();
    })();
  }, [laden]);
  return { zugang, laden };
}

/**
 * Vor `/rank` und `/dm` (20.11.): erst das Gast-Passwort, dann die Seite.
 * Und ab dem Auslosen statt der Seite der Hinweis, sich am Tresen zu melden —
 * ausser fuer den Wirt, der Nachzuegler noch eintragen kann.
 */
export default function GastSchranke({
  sperrText,
  children,
}: {
  sperrText: string;
  children: React.ReactNode;
}) {
  const { zugang, laden } = useZugang();
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Solange unbekannt, die Seite zeigen: der Server prueft beim Absenden ohnehin.
  if (!zugang) return <>{children}</>;

  if (!zugang.gastFrei) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">🔑 Kurz das Passwort</h1>
        <p className="text-muted">Das Passwort für heute wird am Abend angesagt. Einmal pro Handy reicht.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLaeuft(true);
            setFehler(null);
            const res = await fetch("/api/gast", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ passwort }),
            }).catch(() => null);
            if (res?.ok) {
              await laden();
            } else {
              const daten = (await res?.json().catch(() => ({}))) ?? {};
              setFehler(daten.fehler ?? "Das hat nicht geklappt — noch einmal versuchen.");
            }
            setLaeuft(false);
          }}
          className="flex max-w-sm flex-col gap-3"
        >
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoFocus
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            className="min-h-11 rounded-md border border-line bg-card px-3 py-2"
            aria-label="Passwort"
          />
          {fehler && <p className="text-sm text-danger">{fehler}</p>}
          <button
            type="submit"
            disabled={laeuft || passwort.trim().length === 0}
            className="min-h-11 w-fit rounded-md bg-accent px-5 py-2 font-medium text-on-accent disabled:opacity-40"
          >
            Weiter
          </button>
        </form>
      </div>
    );
  }

  if (zugang.auslosungLaeuft) {
    return (
      <Ergebnis sperrText={sperrText} wirt={zugang.wirt}>
        {children}
      </Ergebnis>
    );
  }

  return <>{children}</>;
}

type ErgebnisDaten =
  | { festgelegt: false }
  | {
      festgelegt: true;
      tische: Array<{ titel: string; leitung: string; namen: string[] }>;
      ohnePlatz: string[];
    };

/**
 * Nach dem Festlegen sehen Gaeste, wer an welchem Tisch sitzt (20.11.) —
 * ohne die Stufe, wie gern jemand dorthin wollte. Vorher der Hinweis, dass
 * die Auslosung laeuft.
 */
function Ergebnis({
  sperrText,
  wirt,
  children,
}: {
  sperrText: string;
  wirt: boolean;
  children: React.ReactNode;
}) {
  const [daten, setDaten] = useState<ErgebnisDaten | null>(null);
  const [nachtrag, setNachtrag] = useState(false);
  const laden = useCallback(async () => {
    try {
      const res = await fetch("/api/ergebnis", { cache: "no-store" });
      if (res.ok) setDaten(await res.json());
    } catch {
      // Dann bleibt der Hinweis stehen; "Neu laden" versucht es wieder.
    }
  }, []);
  useEffect(() => {
    void (async () => {
      await laden();
    })();
  }, [laden]);

  const neuLaden = (
    <button
      onClick={() => void laden()}
      className="min-h-11 w-fit rounded-md border border-line px-4 py-2 text-sm"
    >
      Neu laden
    </button>
  );

  // Der Wirt sieht vor dem Festlegen das Formular (Nachzuegler eintragen),
  // danach wie alle das Ergebnis — mit einem Knopf zurueck zum Formular.
  // Bis 20.11. abends sah der angemeldete Wirt auch nach dem Festlegen nur das
  // Formular und hielt das Ergebnis fuer verschwunden.
  if (wirt && (nachtrag || (daten !== null && !daten.festgelegt))) {
    return (
      <>
        <p className="mb-4 rounded-md border border-accent bg-card p-3 text-sm" role="status">
          Die Auslosung läuft — Gäste sind gesperrt. Du bist als Wirt angemeldet und kannst hier
          Nachzügler eintragen; beim Festlegen kommt dann die Rückfrage „dazugekommen“.
          {nachtrag && (
            <button onClick={() => setNachtrag(false)} className="ml-2 text-accent underline">
              Zurück zum Ergebnis
            </button>
          )}
        </p>
        {children}
      </>
    );
  }

  if (!daten?.festgelegt) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">🎲 Die Auslosung läuft</h1>
        <p className="text-muted">{sperrText}</p>
        <p className="text-sm text-muted">Sobald die Tische feststehen, erscheinen sie hier.</p>
        {neuLaden}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">🎲 Die Tische stehen</h1>
        <p className="mt-2 text-muted">Such deinen Namen und geh zu deinem Tisch.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {daten.tische.map((t) => (
          <li key={t.titel + t.leitung} className="rounded-md border border-line bg-card p-4">
            <h2 className="font-semibold text-accent">{t.titel}</h2>
            <p className="text-sm text-muted">Leitung {t.leitung}</p>
            {t.namen.length > 0 ? (
              <p className="mt-2">{t.namen.join(" · ")}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">Niemand.</p>
            )}
          </li>
        ))}
      </ul>
      {daten.ohnePlatz.length > 0 && (
        <p className="rounded-md border border-danger bg-card p-4 text-sm">
          <strong className="text-danger">Noch ohne Platz:</strong> {daten.ohnePlatz.join(" · ")} —
          bitte am Tresen melden.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {neuLaden}
        {wirt && (
          <button
            onClick={() => setNachtrag(true)}
            className="min-h-11 w-fit rounded-md border border-line px-4 py-2 text-sm"
          >
            Nachzügler eintragen (Wirt)
          </button>
        )}
      </div>
    </div>
  );
}
