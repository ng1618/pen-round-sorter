import "server-only";

/**
 * Einstieg fuer den Anwendungscode (Route Handler, Server Components).
 * Alles Echte steht in `./connection` — diese Datei fuegt nur die Absicherung
 * hinzu.
 *
 * `import "server-only"` bricht den Build, falls dieses Modul je in ein
 * Client-Buendel geraet. Next 16 loest den Namen selbst auf, es ist nichts zu
 * installieren: intern zeigt er auf `next/dist/compiled/server-only`, und
 * dessen `exports` liefern unter der Bedingung `react-server` eine leere Datei,
 * sonst eine, die beim Laden wirft. Genau daher stammt die Fehlermeldung — und
 * genau deshalb darf `connection.ts` diesen Import NICHT haben: die Skripte
 * unter `scripts/` laufen in nacktem Node, ganz ohne `react-server`, und wuerden
 * an der werfenden Variante sterben.
 *
 * Damit ist aus der Kommentar-Konvention in `serverStore.ts` eine erzwungene
 * Regel geworden.
 */

export { getDb, closeDb } from "./connection";
