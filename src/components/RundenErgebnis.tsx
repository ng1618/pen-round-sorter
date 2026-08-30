import type { Assignment, PlayerEntry, Round } from "@/lib/types";

/**
 * Die Tische mit ihrer Besetzung — einmal für die Vorschau, einmal fürs
 * festgelegte Ergebnis.
 *
 * Bis zum 30.08. gab es das zweimal im selben Bauteil, fast gleich und schon
 * leicht auseinandergelaufen. Der einzige echte Unterschied ist, ob man
 * jemanden umsetzen darf: liegt `onUmsetzen` an, bekommt jede Zeile ein
 * Auswahlfeld, sonst ist die Liste zum Lesen.
 */
export default function RundenErgebnis({
  runden,
  spieler,
  zuordnungen,
  onUmsetzen,
  onPlaetze,
}: {
  runden: Round[];
  spieler: PlayerEntry[];
  zuordnungen: Assignment[];
  onUmsetzen?: (playerId: number, roundId: number | null) => void;
  /**
   * Platzzahl an Ort und Stelle aendern. Liegt sie an, kann die Verwaltung in
   * Ruecksprache mit der Leitung aufstocken, ohne die Seite zu wechseln —
   * "ach komm, dann machen wir sechs".
   */
  onPlaetze?: (rundenId: number, plaetze: number) => void;
}) {
  const nameVon = (id: number) => spieler.find((p) => p.id === id)?.playerName ?? "?";
  const ohnePlatz = zuordnungen.filter((z) => z.roundId == null);

  function Auswahl({ z }: { z: Assignment }) {
    if (!onUmsetzen) return null;
    return (
      <select
        value={z.roundId ?? ""}
        onChange={(e) => onUmsetzen(z.playerId, e.target.value === "" ? null : Number(e.target.value))}
        aria-label={`${nameVon(z.playerId)} umsetzen`}
        className="rounded-md border border-line bg-card px-2 py-1 text-xs"
      >
        {runden.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
        <option value="">ohne Platz</option>
      </select>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {runden.map((runde) => {
        const sitzend = zuordnungen.filter((z) => z.roundId === runde.id);
        // Ueberbelegung wird **angezeigt, nicht verhindert**: von Hand umsetzen
        // muss auch dann gehen, wenn alle Tische voll sind — bei 15 Personen auf
        // 15 Plaetzen ist das der Normalfall. Der Riegel sitzt beim Festlegen.
        const zuViele = sitzend.length > runde.capacity;
        return (
          <div
            key={runde.id}
            className={
              zuViele
                ? "rounded-md border-2 border-red-700 bg-card p-3 text-sm"
                : "rounded-md border border-line bg-card p-3 text-sm"
            }
          >
            <p className="font-medium">
              {runde.title} — Leitung {runde.dmName}{" "}
              <span className={zuViele ? "text-red-700" : undefined}>
                ({sitzend.length}/{runde.capacity})
              </span>
              {zuViele && (
                <span className="ml-2 text-red-700">
                  überbelegt — {sitzend.length - runde.capacity} zu viel
                </span>
              )}
            </p>

            {onPlaetze && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                Plätze
                <input
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={runde.capacity}
                  onBlur={(e) => {
                    const wert = Number(e.target.value);
                    if (wert !== runde.capacity) onPlaetze(runde.id, wert);
                  }}
                  aria-label={`Plätze in ${runde.title}`}
                  className="w-16 rounded-md border border-line bg-card px-2 py-1"
                />
                {zuViele && <span className="text-red-700">für alle reicht {sitzend.length}</span>}
              </label>
            )}
            <ul className="mt-2 flex flex-col gap-1">
              {sitzend.map((z) => (
                <li key={z.playerId} className="flex items-center justify-between gap-2">
                  <span className="text-muted">{nameVon(z.playerId)}</span>
                  <Auswahl z={z} />
                </li>
              ))}
              {sitzend.length === 0 && <li className="italic text-muted">leer</li>}
            </ul>
          </div>
        );
      })}

      {ohnePlatz.length > 0 && (
        <div className="rounded-md border border-red-700/40 bg-card p-3 text-sm">
          <p className="font-medium">Ohne Platz ({ohnePlatz.length})</p>
          <ul className="mt-2 flex flex-col gap-1">
            {ohnePlatz.map((z) => (
              <li key={z.playerId} className="flex items-center justify-between gap-2">
                <span className="text-muted">{nameVon(z.playerId)}</span>
                <Auswahl z={z} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
