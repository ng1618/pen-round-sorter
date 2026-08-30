import type { Kennzahlen } from "@/lib/protokoll";

/**
 * „Wie gut ist es aufgegangen" — die Levelverteilung einer Auslosung.
 *
 * Ein Baustein statt zweier Fassungen: Vorschau und festgelegtes Ergebnis
 * zeigten dieselbe Liste bis zum 30.08. in zwei getrennten Codeblöcken, die
 * schon leicht auseinandergelaufen waren.
 */
export default function Kennzahlenliste({
  jeLevel,
  ohnePlatz,
  className = "",
}: {
  jeLevel: Kennzahlen["jeLevel"];
  ohnePlatz: number;
  className?: string;
}) {
  return (
    <ul className={`flex flex-col gap-1 text-sm text-muted ${className}`}>
      {jeLevel.map((z) => (
        <li key={z.label}>
          {z.label}: {z.anzahl} Spielende
        </li>
      ))}
      {ohnePlatz > 0 && <li className="text-red-700">Ohne Platz: {ohnePlatz} Spielende</li>}
      {jeLevel.length === 0 && ohnePlatz === 0 && <li>Noch nichts zugeordnet.</li>}
    </ul>
  );
}
