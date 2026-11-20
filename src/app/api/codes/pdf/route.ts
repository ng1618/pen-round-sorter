import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { basisUrl } from "@/lib/basis-url";
import { codesPdf } from "@/lib/codes-pdf";
import { ZIELE, type ZielName } from "@/app/codes/gemeinsam";

/**
 * Beide QR-Codes als PDF, eine A4-Seite je Code (20.11.). Nur fuer den Wirt,
 * wie die Code-Seiten selbst. Die Adresse entsteht bei jedem Abruf neu aus der
 * Anfrage bzw. `PRS_BASIS_URL` — ein heruntergeladenes PDF friert sie ein,
 * deshalb steht sie zum Gegenlesen unter jedem Code.
 */
export async function GET() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const kopfzeilen = await headers();
  const basis = basisUrl((name) => kopfzeilen.get(name), process.env.PRS_BASIS_URL);
  const reihenfolge: ZielName[] = ["rank", "dm"];
  const pdf = codesPdf(
    reihenfolge.map((ziel) => ({
      titel: ZIELE[ziel].titel,
      hinweis: ZIELE[ziel].hinweis,
      url: `${basis.url}${ZIELE[ziel].pfad}`,
    })),
  );

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="rundenverteiler-qr-codes.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
