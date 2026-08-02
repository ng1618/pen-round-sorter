"use client";

import { useState } from "react";

/**
 * Rueckfrage **in der Seite** statt `window.confirm`.
 *
 * Am 02.08. gemessen: in eingebetteten Browsern gibt `confirm()` sofort `false`
 * zurueck, ohne einen Dialog zu zeigen. Der Knopf sieht dann tot aus, und weil
 * genau die destruktiven Aktionen dahinter lagen (zuruecksetzen, entfernen,
 * naechster Tag), waren sie alle drei stumm wirkungslos. Auf fremden Geraeten am
 * Eventabend will man sich darauf nicht verlassen.
 *
 * Nebeneffekt: die Rueckfrage ist lesbar statt ein Systemdialog, und auf dem
 * Handy weniger ruppig.
 */
export default function Bestaetigung({
  knopf,
  frage,
  jaText = "Ja, weiter",
  onJa,
  className = "rounded-md border border-line px-4 py-2 text-sm",
  kompakt = false,
}: {
  knopf: string;
  frage: string;
  jaText?: string;
  onJa: () => void;
  className?: string;
  kompakt?: boolean;
}) {
  const [offen, setOffen] = useState(false);

  if (!offen) {
    return (
      <button onClick={() => setOffen(true)} className={className}>
        {knopf}
      </button>
    );
  }

  if (kompakt) {
    return (
      <span className="flex shrink-0 items-center gap-2 text-xs">
        <button
          onClick={() => {
            setOffen(false);
            onJa();
          }}
          className="rounded-md border border-red-700 px-2 py-1 text-red-700"
        >
          {jaText}
        </button>
        <button onClick={() => setOffen(false)} className="text-muted">
          Abbrechen
        </button>
      </span>
    );
  }

  return (
    <div className="rounded-md border border-accent bg-card p-3 text-sm" role="alertdialog">
      <p className="whitespace-pre-line">{frage}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setOffen(false);
            onJa();
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {jaText}
        </button>
        <button
          onClick={() => setOffen(false)}
          className="rounded-md border border-line px-4 py-2 text-sm text-muted"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
