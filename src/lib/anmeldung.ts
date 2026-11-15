/**
 * Mindestlaenge und Ratenbegrenzung der Verwaltungsanmeldung.
 *
 * Rein und ohne `server-only`, damit das Anmeldeformular dieselbe Zahl benutzt
 * wie die Route und beides ohne Datenbank pruefbar bleibt.
 */

/**
 * Seit dem 14.11. ist Railway der Hauptweg, die Anmeldung also aus dem ganzen
 * Netz erreichbar. Vier Zeichen waren fuer das eigene WLAN gedacht.
 *
 * Gilt nur beim **Setzen** eines Passworts, nicht beim Anmelden: ein vorher
 * gesetztes kuerzeres Passwort muss weiter funktionieren, sonst sperrt dieses
 * Update den Wirt aus der eigenen Verwaltung aus.
 */
export const PASSWORT_MINDESTLAENGE = 8;

export function passwortZuKurz(passwort: string): boolean {
  return passwort.length < PASSWORT_MINDESTLAENGE;
}

export type Bremse = {
  /** Wie lange noch gesperrt ist, in Millisekunden; 0 = frei. */
  wartenMs(jetzt: number): number;
  fehlschlag(jetzt: number): void;
  erfolg(): void;
};

/**
 * Nach `versuche` Fehlversuchen in Folge ist `sperreMs` lang zu.
 *
 * **Eine Zaehlung fuer alle**, nicht je Adresse: Next 16 gibt Route Handlern
 * keine Adresse, uebrig bliebe `x-forwarded-for`, und das setzt der Client
 * selbst — eine Sperre je Adresse liesse sich durch Wechseln des Headers
 * umgehen. Der Preis: wer das Passwort nicht kennt, kann den Wirt fuer eine
 * Minute aussperren. Bei einer einzigen Person in der Verwaltung und 18
 * Bekannten im Haus in Kauf genommen; ratbar wird ein Passwort mit acht Zeichen
 * bei fuenf Versuchen je Minute nicht.
 *
 * Steht im Arbeitsspeicher und beginnt bei einem Neustart von vorn. Fuer eine
 * Bremse reicht das.
 */
export function neueBremse({ versuche = 5, sperreMs = 60_000 } = {}): Bremse {
  let fehlschlaege = 0;
  let gesperrtBis = 0;
  return {
    wartenMs(jetzt) {
      return Math.max(0, gesperrtBis - jetzt);
    },
    fehlschlag(jetzt) {
      fehlschlaege += 1;
      if (fehlschlaege >= versuche) {
        gesperrtBis = jetzt + sperreMs;
        fehlschlaege = 0;
      }
    },
    // Hebt auch eine Sperre auf: die Route zaehlt jeden Versuch vorab als
    // Fehlversuch, ein richtiger fuenfter Versuch sperrte sonst alle anderen.
    erfolg() {
      fehlschlaege = 0;
      gesperrtBis = 0;
    },
  };
}
