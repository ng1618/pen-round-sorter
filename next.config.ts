import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Ohne das laedt ein Handy im LAN zwar die Seite, aber NICHT die Dateien
   * unter `/_next/*`: Next blockiert im Entwicklungsbetrieb standardmaessig
   * Zugriffe auf Entwickler-Ressourcen von anderen Ursprüngen als dem, mit dem
   * der Server gestartet wurde (`localhost`).
   *
   * Das sieht nicht nach einem Fehler aus. Die Seite erscheint, nur ohne ihr
   * JavaScript: Client-Komponenten hydrieren nie, `useEffect` laeuft nie, also
   * wird nie etwas nachgeladen — die Rundenliste bleibt einfach leer. Die
   * Ursache steht im Serverprotokoll ("Blocked cross-origin request"), im
   * Browser steht gar nichts.
   *
   * Gilt nur fuer `next dev`. Der Bereich statt einer festen Adresse, damit ein
   * neuer DHCP-Lease das Testen vom Handy nicht wieder lahmlegt.
   */
  allowedDevOrigins: ["192.168.0.*", "192.168.1.*"],
};

export default nextConfig;
