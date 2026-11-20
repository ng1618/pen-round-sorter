import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Absicherung fuer den Eventabend (20.11.): Gast-Passwort und die Sperre der
 * Runden ab dem Auslosen. Rein und ohne `server-only`, damit beides ohne
 * Datenbank pruefbar bleibt.
 */

/**
 * Wert des Gast-Cookies: vom Passwort abgeleitet, nicht das Passwort selbst.
 * Aendert der Wirt `PRS_GAST_PASSWORT`, passt kein altes Cookie mehr.
 *
 * Bewusst ohne Mindestlaenge und ohne Sperre nach Fehlversuchen (Festlegung
 * 20.11.): eine Sperre kann nur fuer alle gemeinsam gelten, weil der Server
 * keine Absenderadresse sieht — ein Fremder koennte damit alle Gaeste
 * aussperren. Das Passwort wird am Abend angesagt, nicht geheim gehalten.
 */
export function gastWert(passwort: string): string {
  return createHmac("sha256", passwort.normalize("NFKC")).update("gast-zugang").digest("hex");
}

export function gastWertGueltig(wert: string | undefined, passwort: string): boolean {
  if (!wert) return false;
  const erwartet = gastWert(passwort);
  if (wert.length !== erwartet.length) return false;
  return timingSafeEqual(Buffer.from(wert), Buffer.from(erwartet));
}

export type RundenFelder = { dmName: string; title: string; vibe: string; capacity: number };

/**
 * Darf eine Runde so geaendert werden?
 *
 * Nach dem Auslosen nur noch **mehr Plaetze**, sonst nichts. Weniger Plaetze
 * koennten bestehende Zuordnungen ueberbelegen, ohne dass das Festlegen es
 * merkt; eine geaenderte Leitung oder ein anderer Titel passte nicht mehr zu
 * dem, was die Gaeste gerankt haben.
 *
 * @returns Fehlertext, oder `null` wenn erlaubt.
 */
export function rundenAenderungPruefen(
  alt: RundenFelder,
  neu: RundenFelder,
  ausgelost: boolean,
): string | null {
  if (!ausgelost) return null;
  if (neu.title !== alt.title || neu.dmName !== alt.dmName || neu.vibe !== alt.vibe) {
    return "Die Auslosung läuft — Titel, Leitung und Stimmung sind jetzt gesperrt.";
  }
  if (neu.capacity < alt.capacity) {
    return "Die Auslosung läuft — Plätze lassen sich jetzt nur erhöhen.";
  }
  return null;
}
