import { istAngemeldet } from "@/lib/auth";
import { tagInfo } from "@/lib/db/queries";
import { Erreichbarkeit, NurFuerDenWirt, ZIELE, basisAusAnfrage } from "./gemeinsam";

/**
 * Übersicht. Die Codes selbst liegen auf je einer eigenen Seite, damit sie
 * groß genug sind, um vom Bildschirm abgescannt zu werden.
 *
 * `force-dynamic` aus demselben Grund wie bei `/admin`: die Seite liest die
 * Anmeldung und die Kopfzeilen der Anfrage. Vorgerendert wäre beides zur
 * Bauzeit eingefroren.
 */
export const dynamic = "force-dynamic";

export default async function CodesUebersicht() {
  if (!(await istAngemeldet())) return <NurFuerDenWirt />;

  const basis = await basisAusAnfrage();
  const { name } = tagInfo();

  return (
    <div>
      <Erreichbarkeit basis={basis} />

      <h1 className="text-xl font-semibold text-accent">📱 Codes zum Scannen — {name}</h1>
      <p className="mt-2 text-sm text-muted">
        Je ein Code auf eigener Seite, zum Hinhalten. Sie gelten das ganze Wochenende und ändern
        sich an Tag 2 und 3 nicht.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {(Object.keys(ZIELE) as Array<keyof typeof ZIELE>).map((schluessel) => (
          <li key={schluessel}>
            <a
              href={`/codes/${schluessel}`}
              className="block rounded-md border border-line bg-card p-4 hover:border-accent"
            >
              <span className="font-medium text-accent">{ZIELE[schluessel].titel}</span>
              <span className="mt-1 block text-sm text-muted">
                {basis.url}
                {ZIELE[schluessel].pfad}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm">
        <a href="/admin" className="text-muted underline">
          zurück zur Verwaltung
        </a>
      </p>
    </div>
  );
}
