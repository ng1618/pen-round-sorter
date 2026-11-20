import QRCode from "qrcode";

/**
 * Die QR-Codes als PDF zum Herunterladen und Drucken (20.11.).
 *
 * Von Hand geschrieben statt mit einer Bibliothek: ein QR-Code ist nur ein
 * Raster aus Quadraten, und Helvetica und Courier stecken in jedem PDF-Leser.
 * Eine Abhaengigkeit fuer zwei Seiten waere mehr Gewicht als Nutzen.
 *
 * Eine A4-Seite je Code: Titel, Hinweis, Code, darunter die Adresse zum
 * Abtippen fuer die Kamera, die streikt.
 */

export type CodeSeite = { titel: string; hinweis: string; url: string };

const BREITE = 595; // A4 in Punkt
const HOEHE = 842;
const RAND = 56;

/** Zeichen ausserhalb von Latin-1, die WinAnsi trotzdem kennt. */
const WINANSI_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "–": 0x96, "—": 0x97,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
};

/** Text als Hex-String in WinAnsi — Unbekanntes (etwa Emoji) wird zu „?". */
export function winAnsiHex(text: string): string {
  let hex = "";
  for (const zeichen of text) {
    const code = zeichen.codePointAt(0) ?? 0x3f;
    const byte =
      WINANSI_EXTRA[zeichen] ??
      ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) ? code : 0x3f);
    hex += byte.toString(16).toUpperCase().padStart(2, "0");
  }
  return hex;
}

/** Grob umbrechen: Helvetica ist im Mittel etwa halb so breit wie hoch. */
function umbrechen(text: string, groesse: number, breite: number): string[] {
  const proZeile = Math.floor(breite / (groesse * 0.5));
  const zeilen: string[] = [];
  let zeile = "";
  for (const wort of text.split(/\s+/)) {
    if (zeile && (zeile + " " + wort).length > proZeile) {
      zeilen.push(zeile);
      zeile = wort;
    } else {
      zeile = zeile ? `${zeile} ${wort}` : wort;
    }
  }
  if (zeile) zeilen.push(zeile);
  return zeilen;
}

/** Ungefaehre Textbreite fuer das Zentrieren. */
function breiteVon(text: string, groesse: number, faktor: number): number {
  return [...text].length * groesse * faktor;
}

function seitenInhalt(s: CodeSeite): string {
  const teile: string[] = [];
  const text = (font: string, groesse: number, x: number, y: number, inhalt: string) =>
    teile.push(`BT /${font} ${groesse} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td <${winAnsiHex(inhalt)}> Tj ET`);

  let y = HOEHE - RAND - 24;
  text("F2", 26, (BREITE - breiteVon(s.titel, 26, 0.58)) / 2, y, s.titel);
  y -= 30;
  for (const zeile of umbrechen(s.hinweis, 13, BREITE - 2 * RAND)) {
    text("F1", 13, (BREITE - breiteVon(zeile, 13, 0.5)) / 2, y, zeile);
    y -= 18;
  }

  // Der Code: so gross wie die Seite hergibt, mit ruhiger Zone.
  const qr = QRCode.create(s.url, { errorCorrectionLevel: "M" }).modules;
  const kante = Math.min(BREITE - 2 * RAND, y - RAND - 80);
  const modul = kante / (qr.size + 2);
  const x0 = (BREITE - kante) / 2;
  const yOben = y - 20;
  teile.push("0 g");
  for (let zeile = 0; zeile < qr.size; zeile++) {
    // Waagerechte Laeufe zusammenfassen — kleiner und ohne Haarlinien.
    let lauf = -1;
    for (let spalte = 0; spalte <= qr.size; spalte++) {
      const dunkel = spalte < qr.size && qr.get(zeile, spalte);
      if (dunkel && lauf < 0) lauf = spalte;
      if (!dunkel && lauf >= 0) {
        const x = x0 + (lauf + 1) * modul;
        const yy = yOben - (zeile + 2) * modul;
        teile.push(`${x.toFixed(2)} ${yy.toFixed(2)} ${((spalte - lauf) * modul).toFixed(2)} ${modul.toFixed(2)} re`);
        lauf = -1;
      }
    }
  }
  teile.push("f");

  const yAdresse = yOben - kante - 30;
  text("F3", 14, (BREITE - breiteVon(s.url, 14, 0.6)) / 2, yAdresse, s.url);
  return teile.join("\n");
}

/** Das fertige PDF, eine Seite je Code. */
export function codesPdf(seiten: CodeSeite[]): Uint8Array {
  const objekte: string[] = [];
  const seitenIds = seiten.map((_, i) => 6 + i * 2);

  objekte.push("<< /Type /Catalog /Pages 2 0 R >>");
  objekte.push(`<< /Type /Pages /Kids [${seitenIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${seiten.length} >>`);
  objekte.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objekte.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objekte.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  for (const s of seiten) {
    const inhaltId = objekte.length + 2;
    objekte.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${BREITE} ${HOEHE}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${inhaltId} 0 R >>`,
    );
    const inhalt = seitenInhalt(s);
    objekte.push(`<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`);
  }

  // Nur ASCII im Dokument (Text steckt in Hex-Strings) — Zeichen = Bytes.
  let pdf = "%PDF-1.4\n";
  const positionen: number[] = [];
  objekte.forEach((o, i) => {
    positionen.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (const p of positionen) pdf += `${String(p).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
