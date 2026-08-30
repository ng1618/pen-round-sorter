import { notFound } from "next/navigation";
import { istAngemeldet } from "@/lib/auth";
import {
  Erreichbarkeit,
  NurFuerDenWirt,
  ZIELE,
  basisAusAnfrage,
  istZielName,
  qrSvg,
} from "../gemeinsam";

/**
 * Eine Seite je Code. Der Code ist absichtlich so groß, wie der Bildschirm
 * hergibt: gescannt wird er von einem anderen Gerät, und die Trefferquote
 * hängt fast nur an der Modulgröße.
 */
export const dynamic = "force-dynamic";

export default async function CodeSeite({ params }: { params: Promise<{ wofuer: string }> }) {
  const { wofuer } = await params;
  if (!istZielName(wofuer)) notFound();

  if (!(await istAngemeldet())) return <NurFuerDenWirt />;

  const ziel = ZIELE[wofuer];
  const basis = await basisAusAnfrage();
  const url = `${basis.url}${ziel.pfad}`;
  const svg = await qrSvg(url);

  return (
    <div>
      <Erreichbarkeit basis={basis} />

      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-accent">{ziel.titel}</h1>
        <p className="max-w-md text-muted">{ziel.hinweis}</p>

        {/* Das SVG bringt nur eine `viewBox` mit, keine `width`/`height`. Ohne
            die beiden Regeln zieht der Browser es auf seine Standardgroesse von
            300x150 und quetscht das quadratische Muster flach — unscannbar. */}
        <div
          className="w-[min(85vw,60vh)] bg-white p-4 [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-hidden="true"
        />

        {/* Fuer die Kamera, die streikt: abtippbar. */}
        <p className="font-mono text-sm break-all">{url}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
          <a href={`/codes/${ziel.anderes}`} className="text-accent underline">
            → {ziel.anderesText}
          </a>
          <a href="/admin" className="text-muted underline">
            zurück zur Verwaltung
          </a>
        </div>
      </div>
    </div>
  );
}
