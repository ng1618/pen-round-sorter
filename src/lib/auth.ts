import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminPasswort, setAdminPasswort } from "./db/queries.ts";

/**
 * Ein gemeinsames Passwort schuetzt die Verwaltung (ENTSCHEIDUNGEN.md, 29.07.).
 * Gehasht mit `scrypt` aus Node — kein zusaetzliches Paket.
 *
 * ⚠️ Im Heimnetz laeuft das ueber **http**, das Passwort geht also im Klartext
 * ueber die Leitung. Fuer 18 Bekannte im eigenen WLAN ist das vertretbar, aber
 * es ist eine bewusste Annahme und keine Nebensaechlichkeit: wer im selben Netz
 * mitliest, sieht es. Mit dem Deployment (KW33) laeuft es ueber https.
 */

const COOKIE = "prs_admin";
const KEYLEN = 64;

function hash(passwort: string, salt: string): string {
  return scryptSync(passwort.normalize("NFKC"), salt, KEYLEN).toString("hex");
}

/** Setzt das Passwort — bei der Ersteinrichtung und beim Aendern. */
export function passwortSetzen(passwort: string): void {
  const salt = randomBytes(16).toString("hex");
  setAdminPasswort(hash(passwort, salt), salt);
}

export function passwortGesetzt(): boolean {
  return adminPasswort() !== null;
}

function passwortStimmt(passwort: string): boolean {
  const gespeichert = adminPasswort();
  if (!gespeichert) return false;
  const a = Buffer.from(hash(passwort, gespeichert.salt), "hex");
  const b = Buffer.from(gespeichert.hash, "hex");
  // Gleich lang per Konstruktion, aber timingSafeEqual wirft sonst.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Der Sitzungswert wird aus dem gespeicherten Hash abgeleitet, nicht zufaellig
 * vergeben — dann braucht es keine Sitzungstabelle, und ein Passwortwechsel
 * macht alle alten Cookies automatisch ungueltig.
 */
function sitzungswert(): string | null {
  const gespeichert = adminPasswort();
  if (!gespeichert) return null;
  return createHmac("sha256", gespeichert.hash).update("admin-sitzung").digest("hex");
}

export async function anmelden(passwort: string): Promise<boolean> {
  if (!passwortStimmt(passwort)) return false;
  const wert = sitzungswert();
  if (!wert) return false;

  (await cookies()).set(COOKIE, wert, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // ein Abend
  });
  return true;
}

export async function abmelden(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Die eigentliche Schranke. Wird von der Seite UND von den Routen benutzt. */
export async function istAngemeldet(): Promise<boolean> {
  const erwartet = sitzungswert();
  if (!erwartet) return false;
  const vorhanden = (await cookies()).get(COOKIE)?.value;
  if (!vorhanden || vorhanden.length !== erwartet.length) return false;
  return timingSafeEqual(Buffer.from(vorhanden), Buffer.from(erwartet));
}
