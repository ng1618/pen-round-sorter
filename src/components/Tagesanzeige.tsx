"use client";

import { useEffect, useState } from "react";

type TagInfo = { name: string; tag: number; tage: number };

/**
 * „Novemberwochenende · Tag 2 von 3".
 *
 * Steht auch auf `/dm` und `/rank`, nicht nur in der Verwaltung: wer am Samstag
 * den Link oeffnet, soll sehen, fuer welchen Tag er eintraegt. Sonst glaubt
 * jemand, er gebe fuers ganze Wochenende ab — oder er hat Freitag schon
 * abgegeben und weiss nicht, ob das noch zaehlt.
 *
 * Bei einem einzigen Tag wird nichts angezeigt; dann gibt es nichts zu
 * verwechseln.
 */
export default function Tagesanzeige() {
  const [info, setInfo] = useState<TagInfo | null>(null);

  useEffect(() => {
    fetch("/api/wochenende")
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  if (!info || info.tage <= 1) return null;

  return (
    <p className="text-sm text-muted">
      {info.name} · <strong>Tag {info.tag} von {info.tage}</strong>
    </p>
  );
}
