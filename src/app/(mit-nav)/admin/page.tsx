import { istAngemeldet, passwortGesetzt } from "@/lib/auth";
import AdminClient from "./AdminClient";
import AnmeldeFormular from "./AnmeldeFormular";

/**
 * MUSS dynamisch bleiben. Sonst rendert Next diese Seite zur **Bauzeit** vor,
 * und die Schranke wird einmal ausgewertet und eingefroren: im
 * Produktionsbetrieb kam dann fuer alle und fuer immer das Anmeldeformular —
 * auch mit gueltigem Cookie.
 *
 * Der Grund ist unangenehm subtil: `istAngemeldet()` kehrt zurueck, *bevor* es
 * `cookies()` anfasst, wenn noch kein Passwort gesetzt ist. Ohne Aufruf einer
 * dynamischen API haelt Next die Seite fuer statisch. Ob die Verwaltung
 * funktioniert, haengt damit am Datenbankzustand zum Zeitpunkt des Builds —
 * im Entwicklungsbetrieb faellt das nie auf, weil dort alles dynamisch rendert.
 *
 * Gefunden im Code-Durchgang am 01.08. mit `next build && next start`.
 */
export const dynamic = "force-dynamic";

/**
 * Serverseitige Schranke. Wichtig: sie versteckt nicht nur die Oberflaeche —
 * die Routen `/api/reset`, `POST /api/assignments` und
 * `DELETE /api/entries/[id]` pruefen dieselbe Anmeldung noch einmal selbst.
 * Nur die Seite zu schuetzen waere Theater, weil jeder im Netz die Routen
 * direkt aufrufen kann.
 */
export default async function AdminPage() {
  if (await istAngemeldet()) return <AdminClient />;
  return <AnmeldeFormular ersteinrichtung={!passwortGesetzt()} />;
}
