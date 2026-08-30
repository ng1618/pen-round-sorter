import { headers } from "next/headers";
import QRCode from "qrcode";
import { basisUrl, type Basis } from "@/lib/basis-url";

/**
 * Gemeinsames für die QR-Seiten.
 *
 * Die Codes werden **nicht gedruckt**, sondern vom Bildschirm abgescannt — vom
 * Handy einer Verwaltung oder vom Laptop (Festlegung vom 30.08.). Daraus folgt
 * dreierlei: jeder Code bekommt eine **eigene Seite**, damit er groß sein kann;
 * es gibt kein Druck-Layout; und die Adresse ist immer die aktuelle, weil sie
 * bei jedem Aufruf neu entsteht. Das Risiko einer eingefrorenen Adresse, das
 * ein Ausdruck mit sich brächte, existiert hier gar nicht.
 */

export const ZIELE = {
  dm: {
    pfad: "/dm",
    titel: "Für die Spielleitungen",
    hinweis: "Hier trägst du deine Runde ein: Titel, Stimmung und wie viele Plätze du hast.",
    anderes: "rank",
    anderesText: "Code für Spielende",
  },
  rank: {
    pfad: "/rank",
    titel: "Für die Spielenden",
    hinweis:
      "Hier sagst du, worauf du Lust hast. Dauert eine Minute — wer nichts abgibt, wird trotzdem gesetzt.",
    anderes: "dm",
    anderesText: "Code für Spielleitungen",
  },
} as const;

export type ZielName = keyof typeof ZIELE;

export function istZielName(wert: string): wert is ZielName {
  return wert === "dm" || wert === "rank";
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    // "M" verträgt rund 15 % Beschädigung. Auf einem Bildschirm gibt es keine
    // Beschädigung; dichter als nötig zu kodieren macht das Muster nur feiner
    // und damit auf kleinen Displays schlechter scannbar.
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function basisAusAnfrage(): Promise<Basis> {
  const kopfzeilen = await headers();
  return basisUrl((name) => kopfzeilen.get(name), process.env.PRS_BASIS_URL);
}

export function NurFuerDenWirt() {
  return (
    <div className="rounded-md border border-line bg-card p-6 text-center">
      <p className="text-lg">🔒 Diese Seite gehört dem Wirt.</p>
      <p className="mt-2 text-sm text-muted">
        Die Codes zeigt die Verwaltung —{" "}
        <a href="/admin" className="text-accent underline">
          dort anmelden
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Sagt, wer den Code einlösen kann. Der Fehler, den das verhindert: den Code
 * auf `localhost` öffnen und ihn einem fremden Handy hinhalten — das Handy
 * erreicht die Adresse nicht, und am Bildschirm sieht man dem Muster nicht an,
 * was darin steht.
 */
export function Erreichbarkeit({ basis }: { basis: Basis }) {
  if (basis.erreichbarkeit === "oeffentlich") return null;

  if (basis.erreichbarkeit === "nur-dieser-rechner") {
    return (
      <div className="mb-6 rounded-md border-2 border-red-700 bg-card p-4" role="alert">
        <p className="font-semibold text-red-700">Dieser Code führt ins Leere.</p>
        <p className="mt-2 text-sm">
          Er zeigt auf <span className="font-mono">{basis.url}</span> — das ist nur dieser Rechner.
          Ein anderes Gerät kommt da nicht hinein; gescannt passiert nichts.
        </p>
        <p className="mt-2 text-sm text-muted">
          Diese Seite stattdessen über die WLAN-Adresse dieses Rechners aufrufen
          (<span className="font-mono">http://192.168.…:3000/codes</span>) oder über die öffentliche
          Adresse.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-md border border-accent bg-card p-4">
      <p className="text-sm">
        <span className="font-medium text-accent">Adresse im eigenen WLAN.</span> Der Code zeigt auf{" "}
        <span className="font-mono">{basis.url}</span> — jedes Gerät im selben WLAN kommt damit
        hinein. Genau so läuft auch der Laptop-Notausgang.
      </p>
    </div>
  );
}
