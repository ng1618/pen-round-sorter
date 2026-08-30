import { istAngemeldet, passwortGesetzt } from "@/lib/auth";
import AnmeldeFormular from "../AnmeldeFormular";
import EinstellungenClient from "./EinstellungenClient";

/** Dynamisch aus demselben Grund wie `/admin` — siehe Kommentar in `../page.tsx`. */
export const dynamic = "force-dynamic";

export default async function EinstellungenSeite() {
  if (await istAngemeldet()) return <EinstellungenClient />;
  return <AnmeldeFormular ersteinrichtung={!passwortGesetzt()} />;
}
