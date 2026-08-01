import { istAngemeldet, passwortGesetzt } from "@/lib/auth";
import AdminClient from "./AdminClient";
import AnmeldeFormular from "./AnmeldeFormular";

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
