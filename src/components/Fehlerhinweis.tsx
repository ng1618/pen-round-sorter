/**
 * Sichtbarer Fehler statt stiller Leere.
 *
 * Ohne das sieht eine fehlgeschlagene Abfrage genauso aus wie „es gibt noch
 * nichts" — genau der Fehlermodus, der beim ersten Test vom Handy eine Stunde
 * gekostet hat: die Seite kam an, ihr JavaScript nicht, die Rundenliste blieb
 * einfach leer und nichts wies auf die Ursache hin.
 */
export default function Fehlerhinweis({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {text}
    </p>
  );
}
