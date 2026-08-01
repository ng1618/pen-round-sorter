/**
 * Fuer Gaeste: `/dm` und `/rank`. Bewusst OHNE Navigationsleiste — wer den Link
 * bekommt, soll seine Runde eintragen oder seine Wuensche abgeben, nicht durch
 * die Verwaltung stolpern.
 *
 * Das ist Bequemlichkeit, kein Schutz: `/admin` bleibt erreichbar, wer die
 * Adresse kennt. Abgesichert wird sie ueber das Passwort (KW33) und die
 * unratbaren Tokens (KW38).
 */
export default function OhneNavLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>;
}
