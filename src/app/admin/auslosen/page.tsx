import { istAngemeldet, passwortGesetzt } from "@/lib/auth";
import AnmeldeFormular from "../AnmeldeFormular";
import AuslosungClient from "./AuslosungClient";

/**
 * MUSS dynamisch bleiben — dieselbe Falle wie bei `/admin`: statisch
 * vorgerendert wird die Schranke zur Bauzeit einmal ausgewertet und
 * eingefroren. Siehe den ausfuehrlichen Kommentar in `../page.tsx`.
 */
export const dynamic = "force-dynamic";

export default async function AuslosungSeite() {
  if (await istAngemeldet()) return <AuslosungClient />;
  return <AnmeldeFormular ersteinrichtung={!passwortGesetzt()} />;
}
