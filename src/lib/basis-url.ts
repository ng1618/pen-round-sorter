/**
 * Die oeffentliche Adresse der Anwendung — die Adresse, die in die QR-Codes
 * eingebrannt wird.
 *
 * Warum das ueberhaupt eine eigene Datei mit Tests ist: ein QR-Code auf Papier
 * **friert eine URL ein**. Ist sie falsch, merkt es niemand beim Drucken,
 * sondern achtzehn Leute am Freitagabend. Das ist der teuerste Zeitpunkt fuer
 * einen Fehler in diesem Projekt, also gehoert genau dieses Stueck geprueft.
 *
 * Zwei Quellen, in dieser Reihenfolge:
 *
 * 1. `PRS_BASIS_URL`, falls gesetzt. Das ist die verlaessliche Variante fuer
 *    den Ausdruck: einmal auf die endgueltige Adresse gesetzt, kann sie nicht
 *    mehr davon abhaengen, ueber welchen Weg gerade jemand die Seite aufruft.
 * 2. Sonst aus den Kopfzeilen der Anfrage. Hinter Railways Proxy stehen die
 *    echten Werte in `x-forwarded-host`/`x-forwarded-proto`; `host` ist dort
 *    die interne Adresse und waere unbrauchbar.
 *
 * `erreichbarkeit` sagt, wer diese Adresse aufrufen kann. **Drei** Stufen und
 * nicht zwei, weil das Heimnetz hier ein regulaerer Betriebsmodus ist:
 *
 * - `nur-dieser-rechner` — `localhost`. Ein Handy kommt hier nie hinein.
 *   Immer falsch, egal wofuer.
 * - `heimnetz` — private Adresse wie `192.168.0.12`. Fuer den
 *   **Laptop-Notausgang** genau richtig, und auch fuer eine Probe mit dem
 *   eigenen Handy. Nur zum Drucken fuer den Railway-Betrieb taugt sie nicht.
 * - `oeffentlich` — von ueberall erreichbar.
 *
 * Zwei Stufen waeren hier eine Falschaussage: sie wuerden die Heimnetz-Probe
 * als Fehler ausweisen, obwohl sie der vorgesehene Weg ist.
 */

export type Erreichbarkeit = "nur-dieser-rechner" | "heimnetz" | "oeffentlich";
export type Basis = { url: string; erreichbarkeit: Erreichbarkeit };

function einstufen(host: string): Erreichbarkeit {
  const name = host.split(":")[0].toLowerCase();

  if (name === "localhost" || name === "127.0.0.1" || name === "0.0.0.0") {
    return "nur-dieser-rechner";
  }
  // Private Netze nach RFC 1918 plus mDNS-Namen — im Heimnetz-Betrieb der
  // Normalfall, deshalb eigene Stufe und kein Fehler.
  if (
    /^10\./.test(name) ||
    /^192\.168\./.test(name) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(name) ||
    name.endsWith(".local")
  ) {
    return "heimnetz";
  }
  return "oeffentlich";
}

/** Nur fuer die Protokollwahl: braucht diese Adresse http statt https? */
function ohneTls(host: string): boolean {
  return einstufen(host) !== "oeffentlich";
}

export function basisUrl(
  kopfzeile: (name: string) => string | null | undefined,
  ausUmgebung?: string,
): Basis {
  const gesetzt = ausUmgebung?.trim();
  if (gesetzt) {
    const ohneSchraegstrich = gesetzt.replace(/\/+$/, "");
    let host = ohneSchraegstrich;
    try {
      host = new URL(ohneSchraegstrich).host;
    } catch {
      // Kein gueltiges URL-Format: unveraendert durchreichen. Die Anzeige zeigt
      // die Adresse im Klartext, dort faellt Unsinn auf — anders als in einem
      // QR-Code, den niemand lesen kann.
    }
    return { url: ohneSchraegstrich, erreichbarkeit: einstufen(host) };
  }

  const host = kopfzeile("x-forwarded-host") ?? kopfzeile("host") ?? "localhost:3000";
  const protokoll = kopfzeile("x-forwarded-proto") ?? (ohneTls(host) ? "http" : "https");

  return { url: `${protokoll}://${host}`, erreichbarkeit: einstufen(host) };
}
