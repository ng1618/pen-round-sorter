"use client";

import { useState } from "react";

export default function AnmeldeFormular({ ersteinrichtung }: { ersteinrichtung: boolean }) {
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);

    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwort }),
    });

    if (res.ok) {
      // Neu laden, damit die Serverkomponente die Schranke erneut auswertet.
      window.location.reload();
      return;
    }
    const { fehler: text } = await res.json();
    setFehler(text ?? "Anmeldung fehlgeschlagen.");
    setLaeuft(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">🏰 {ersteinrichtung ? "Ersteinrichtung" : "Verwaltung"}</h1>
        <p className="mt-2 text-muted">
          {ersteinrichtung
            ? "Es ist noch kein Passwort gesetzt. Das erste, das du hier einträgst, gilt ab sofort."
            : "Bitte das Verwaltungspasswort eingeben."}
        </p>
      </div>

      <form onSubmit={absenden} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            type="password"
            autoComplete={ersteinrichtung ? "new-password" : "current-password"}
            className="rounded-md border border-line bg-card px-3 py-2"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            required
            minLength={4}
          />
        </label>

        {fehler && <p className="text-sm text-red-700">{fehler}</p>}

        <button
          type="submit"
          disabled={laeuft || passwort.length < 4}
          className="w-fit rounded-md bg-accent px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          {ersteinrichtung ? "Passwort setzen" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
