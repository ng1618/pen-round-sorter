import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  adminPasswort,
  setAdminPasswort,
  sitzungsVersion,
  sitzungsVersionErhoehen,
} from "./db/queries.ts";

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
const GUELTIG_MS = 12 * 60 * 60 * 1000; // ein Abend

function hash(passwort: string, salt: string): string {
  return scryptSync(passwort.normalize("NFKC"), salt, KEYLEN).toString("hex");
}

/** Setzt das Passwort — bei der Ersteinrichtung und beim Aendern. */
export function passwortSetzen(passwort: string): void {
  const salt = randomBytes(16).toString("hex");
  setAdminPasswort(hash(passwort, salt), salt);
}

/**
 * Erstes Passwort aus der Umgebung uebernehmen, falls noch keins gesetzt ist.
 *
 * Damit gibt es im Betrieb **nie** einen offenen Einrichtungs-Endpunkt: auf
 * Railway setzt man `PRS_ADMIN_PASSWORT` im Dashboard, lokal in `.env.local`
 * (von `.gitignore` als `.env*` abgedeckt). Ist nichts gesetzt, bleibt das
 * Formular — bequem daheim, und seit `resetAll()` das Passwort stehen laesst
 * ist dieses Fenster nur noch der allererste Start.
 *
 * ⚠️ Bewusst **keine** Herkunftspruefung auf localhost: Next 16 gibt Route
 * Handlern keine Adresse mehr, uebrig bliebe `x-forwarded-for` — ein Header,
 * den der Client selbst setzt. Hinter einem Proxy koennte sich damit jeder als
 * 127.0.0.1 ausgeben. Das waere eine Attrappe, keine Absicherung.
 */
function ausUmgebungUebernehmen(): void {
  const ausUmgebung = process.env.PRS_ADMIN_PASSWORT;
  if (!ausUmgebung || adminPasswort() !== null) return;
  passwortSetzen(ausUmgebung);
}

export function passwortGesetzt(): boolean {
  ausUmgebungUebernehmen();
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
 * Der Sitzungswert ist `ablauf.signatur`. Abgeleitet aus dem gespeicherten Hash,
 * nicht zufaellig vergeben — dann braucht es keine Sitzungstabelle, und ein
 * Passwortwechsel macht alle alten Cookies automatisch ungueltig.
 *
 * Der Ablauf steht **im signierten Wert** und wird serverseitig geprueft.
 * Vorher lag die Gueltigkeit allein in `maxAge`, und das ist eine Bitte an den
 * Browser: wer den Wert kopiert, setzt ihn ohne Ablauf. Im Sicherheitsdurchgang
 * am 01.08. belegt — eine Kopie oeffnete nach dem Abmelden weiterhin
 * `POST /api/reset`.
 */
function signatur(hash: string, ablauf: number, version: number): string {
  return createHmac("sha256", hash).update(`admin-sitzung:${ablauf}:${version}`).digest("hex");
}

/**
 * `sicher` kommt aus dem **tatsaechlichen Protokoll der Anfrage**, nicht aus
 * `NODE_ENV`.
 *
 * Vorher stand hier `secure: NODE_ENV === "production"`. Das klingt vernuenftig
 * und macht die Anmeldung im Laptop-Betrieb unmoeglich: `next start` setzt
 * NODE_ENV auf "production", die Verbindung im Heimnetz ist aber http — der
 * Browser verwirft ein `Secure`-Cookie dort stillschweigend, man kann sich also
 * anmelden und bleibt trotzdem draussen. Am 01.08. im Produktionsbetrieb belegt.
 *
 * `x-forwarded-proto` ist zwar client-setzbar, aber in beide Richtungen
 * harmlos: auf "https" zu luegen schadet nur dem Luegenden (sein eigenes Cookie
 * wird strenger), auf "http" zu luegen nimmt dem eigenen Cookie ein Flag auf
 * einer Verbindung, die ohnehin verschluesselt ist.
 */
export async function anmelden(passwort: string, sicher: boolean): Promise<boolean> {
  if (!passwortStimmt(passwort)) return false;
  const gespeichert = adminPasswort();
  if (!gespeichert) return false;

  const ablauf = Date.now() + GUELTIG_MS;

  (await cookies()).set(COOKIE, `${ablauf}.${signatur(gespeichert.hash, ablauf, sitzungsVersion())}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: sicher,
    path: "/",
    maxAge: GUELTIG_MS / 1000,
  });
  return true;
}

/** Laeuft diese Anfrage ueber https? Hinter einem Proxy sagt es der Header. */
export function ueberHttps(request: Request): boolean {
  const weitergereicht = request.headers.get("x-forwarded-proto");
  if (weitergereicht) return weitergereicht.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

/**
 * Abmelden zaehlt die Sitzungsversion hoch — sonst waere es reine Kosmetik im
 * Browser, und eine kopierte Cookie-Kopie bliebe gueltig. Es meldet damit alle
 * Sitzungen ab; bei genau einem Wirt ist das gewollt.
 */
export async function abmelden(): Promise<void> {
  sitzungsVersionErhoehen();
  (await cookies()).delete(COOKIE);
}

/** Die eigentliche Schranke. Wird von der Seite UND von den Routen benutzt. */
export async function istAngemeldet(): Promise<boolean> {
  const gespeichert = adminPasswort();
  if (!gespeichert) return false;

  const vorhanden = (await cookies()).get(COOKIE)?.value;
  if (!vorhanden) return false;

  const [ablaufText, mitgebracht] = vorhanden.split(".");
  const ablauf = Number(ablaufText);
  if (!Number.isFinite(ablauf) || ablauf <= Date.now()) return false;

  // Erst nach der Ablaufpruefung vergleichen — und laengengleich, sonst wirft
  // timingSafeEqual.
  const erwartet = signatur(gespeichert.hash, ablauf, sitzungsVersion());
  if (!mitgebracht || mitgebracht.length !== erwartet.length) return false;
  return timingSafeEqual(Buffer.from(mitgebracht), Buffer.from(erwartet));
}
