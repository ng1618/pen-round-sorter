# Phase 4 — Teilnehmerliste, Mehrfach-Alarm, Ausgleich über die Tage

> Stand 2026-11-15 · **schlank gebaut** nach Review am selben Tag
>
> **Entschieden:** Der Ausgleich über die Tage bleibt am Event aus. Gebaut sind
> nur Teilnehmerliste (1), Mehrfach-Alarm (2, in geänderter Form, siehe dort)
> und der Seed für drei Tage. Abschnitt 3 und die Schritte 3, 5–7 und 9 sind
> **nicht gebaut** und bleiben hier als Entwurf für nach dem Event stehen;
> Schritt 10 entfällt, weil der Test in `check-db.mjs` schon existierte.
> Begründung: `ENTSCHEIDUNGEN.md`, Eintrag vom 15.11.
> Grund: Das Event hat drei Spieltage (Fr 20. – So 22.11.). Phase 4 wird ab dem
> zweiten Tag gebraucht und steht deshalb im Eventplan vor Generalprobe 1.

## Ziel

Am zweiten und dritten Spieltag soll

1. sichtbar sein, wer an welchem Tag dabei war (**Teilnehmerliste**, reine Info),
2. auffallen, wenn am selben Tag zweimal unter demselben Namen eingereicht wird
   (**Mehrfach-Alarm**, reine Info, blockiert nichts),
3. wer an einem früheren Tag seinen 🔥-Topwunsch nicht bekam, früher gezogen
   werden (**Ausgleich über die Tage**, nur wenn in den Einstellungen eingeschaltet).

## Ausgangslage im Code

| Was | Wo | Stand |
|---|---|---|
| Ein Spieltag = ein `event`, mehrere ergeben ein `wochenende` | `src/lib/db/connection.ts`, Schritt 4 | steht |
| `spieler` gehört zu genau einem Tag, eindeutig über `(event_id, name_key)` | `schema.sql` | steht — **keine Verbindung** zwischen den Tagen |
| Erneutes Einreichen unter gleichem Namen ersetzt die alte Einreichung (Upsert) | `queries.ts`, `addEntry` | gewollt (eigene Wahl ändern), aber still |
| Schalter `ausgleichUeberTage` | `types.ts`, Einstellungsseite, `/api/einstellungen` | gebaut, **ohne Wirkung** |
| Losreihenfolge: „mit Wunsch" vor „gleichgültig", je Gruppe gemischt | `matching.ts`, `runMatching` | steht |
| `resetAll()` löscht nur den aktuellen Tag | `queries.ts` | **seit 30.08. behoben**, aber ohne Test über mehrere Tage |

## Entwurf

### 1. Teilnehmerliste — berechnet, nicht gespeichert

Identität über die Tage = gleicher `name_key` innerhalb desselben `wochenende`.
Keine neue Tabelle, kein Fremdschlüssel zwischen den Tagen.

- Neue Abfrage `anwesenheit(db)` in `queries.ts`: für jeden `name_key` des
  aktuellen Tages die Liste der Tage dieses Wochenendes, an denen es einen
  `spieler` mit demselben `name_key` gab.
- Anzeige im Tresen (`/admin`), je Spielende: „Tag 1 ✓ · Tag 2 ✓ · Tag 3 –".

**Warum berechnet:** dieselbe Begründung wie beim Vorrang (`DATENBANK.md` 1.3) —
eine gespeicherte Verknüpfung müsste bei jeder Umbenennung, jedem Löschen und
jedem Zurücksetzen mitgepflegt werden. Die Abfrage ist bei 15 Personen × 3 Tagen
kostenlos.

**Bewusste Grenze:** Zwei verschiedene Menschen mit gleichem Namen gelten als eine
Person. Dagegen hilft Punkt 2; ein unscharfer Namensabgleich (Tippfehler,
„Max" vs. „Maximilian") bleibt verschoben (Lern-Bit Levenshtein/Jaro-Winkler).

### 2. Mehrfach-Alarm — gespeichert, weil er sonst verloren ginge

> **So gebaut (abweichend vom Entwurf darunter):** Spalte `aenderungen` statt
> `einreichungen`. Gezählt wird nur, wenn eine Einreichung eine frühere mit
> **anderem** Ranking ersetzt — zweimal dasselbe (Netz gewackelt) fällt nicht
> auf, die Erst-Einreichung nach dem Anlegen am Tresen auch nicht. Vergleich in
> `src/lib/einreichung.ts`. Angezeigt über die geschlossene Route
> `GET /api/teilnehmerliste`, nicht über `PlayerEntry` (offene Route).

Der Upsert in `addEntry` überschreibt still. Ob eine Einreichung eine
bestehende ersetzt hat, lässt sich hinterher **nicht** mehr berechnen — deshalb
hier als einzige Stelle eine Spalte.

- **Migrationsschritt 6:** `ALTER TABLE spieler ADD COLUMN einreichungen INTEGER NOT NULL DEFAULT 0`
- `addEntry`: zählt bei jeder Einreichung hoch (`einreichungen = einreichungen + 1`
  im `DO UPDATE`, `1` beim Einfügen). `addSpielerOhneEinreichung` lässt sie bei 0.
- `PlayerEntry` bekommt `einreichungen: number`.
- Tresen: ab `einreichungen >= 2` ein Hinweis „⚠️ 2× eingereicht — gleiche Person
  oder Namensgleichheit?". Kein Sperren, keine Rückfrage an den Gast: wer die
  eigene Wahl ändert, soll das weiter ohne Hürde können.
- Was die Verwaltung im Kollisionsfall tut: eine der beiden Personen bittet, mit
  unterscheidbarem Namen neu einzureichen (z.B. „Max B."). Die erste Einreichung
  ist dann allerdings schon überschrieben — der Alarm meldet, er rettet nicht.

### 3. Ausgleich über die Tage — Vorrang in der Losreihenfolge (NICHT gebaut)

> **Vor einem späteren Bau zu klären:** Das Manipulationsargument unten hält
> nicht — 🔥 auf die überlaufene Runde, die echte Wahl auf ✨: verfehlt, trotzdem
> am Wunschtisch, und am nächsten Tag Vorrang. Ferner: Handkorrektur
> (`/api/matching/aktuell`) führt den Vorrang nicht mit; Vorrang für Leitende;
> Wirkung bei Unterdeckung.

**Regel:** `vorrang(person)` = Anzahl früherer Tage dieses Wochenendes, an denen
die Person (gleicher `name_key`) eine Runde mit 🔥 markiert **und** im
festgelegten Lauf dieses Tages nicht Level 3 bekommen hat (anderes Level oder
kein Platz).

- Gezählt wird das **festgelegte Ergebnis** (neuester `matching_lauf` je Tag),
  nicht die Vorschau.
- Nur frühere Tage. Am Tag 1 ist der Vorrang für alle 0, das Verfahren also
  unverändert.
- Neue reine Funktion `vorrangAusHistorie(...)` in `src/lib/vorrang.ts` (ohne
  Datenbank, testbar), dazu eine Abfrage in `queries.ts`, die die Historie liefert.

**Einbau in `runMatching`** (nur RSD, nur wenn `ausgleichUeberTage` an):

```
mitWunsch  → nach Vorrang absteigend in Stufen, jede Stufe für sich gemischt
gleichgültig → unverändert gemischt, weiter hinten
```

Unter Unterdeckung („einheitlich") wird ebenfalls nach Vorrang gestuft, innerhalb
der Stufe gemischt.

**Manipulationsfestigkeit bleibt:** Der Vorrang hängt am **Ergebnis** früherer
Tage, nicht an einer Angabe. Ein erfundenes 🔥 am Freitag bringt am Samstag nur
dann etwas, wenn man den Freitags-Topwunsch tatsächlich nicht bekam — und dann
hat man am Freitag an einem ungewollten Tisch gesessen. Das ist kein Gewinn.

**Nachvollziehbarkeit:** Der Vorrang jeder Person wandert in den
`eingabestand` des Laufs (`vorrang: Record<spielerId, number>`), und
`konfiguration.ausgleichUeberTage` steht ohnehin schon drin. Das Protokoll
bekommt eine Zeile „Vorrang aus früheren Tagen: Anna 1, Ben 1, übrige 0".

**Leximin:** bekommt den Vorrang in dieser Phase **nicht**. Leximin optimiert ein
Gesamtziel; dort hätte Vorrang die Form eines Gewichts in der Kostenmatrix — genau
der Weg, den die offene Aufgabe „Vorrang über die Losreihenfolge — NICHT über
Gewichte" ausschließt. Die Einstellungsseite bekommt dazu einen Satz: „wirkt nur
beim Losverfahren".

### 4. Regressionstest Tageswechsel

Ein Test über drei Tage: Tag 1 auslosen und festlegen, Tag 2 anlegen,
`resetAll()` am Tag 2 → Tag 1 samt Lauf ist unverändert. Sichert den Fix vom
30.08. ab, der bisher nur im Kommentar steht.

## Umsetzungsschritte

> **Gebaut wurden 1, 2, 4, 8 (ohne Vorrang), 11 und 12** — 1 und 2 abweichend:
> Spalte `aenderungen`, geliefert über `teilnehmerliste()` statt `listEntries`
> (siehe Abschnitt 2).

| # | Schritt | Dateien | Test |
|---|---|---|---|
| 1 | Migrationsschritt 6: `spieler.einreichungen` | `connection.ts` | `db:check` grün, `SCHEMA_VERSION` = 6 |
| 2 | `addEntry` zählt hoch, `listEntries` liefert `einreichungen` | `queries.ts`, `types.ts` | zweimal einreichen → 2; ohne Einreichung angelegt → 0 |
| 3 | `vorrangAusHistorie` als reine Funktion | `src/lib/vorrang.ts` (neu) | `tests/vorrang.test.mjs`: Tag 1 = 0; 🔥 verfehlt = 1; 🔥 bekommen = 0; kein 🔥 = 0; zwei Tage verfehlt = 2; kein Platz zählt als verfehlt |
| 4 | Historie-Abfrage + `anwesenheit` | `queries.ts` | gegen Wegwerf-DB in `check-db.mjs` |
| 5 | `runMatching(rounds, entries, vorrang?)` stuft nach Vorrang | `matching.ts` | `matching.test.mjs`: ohne Vorrang unverändert (bestehende Tests grün); höherer Vorrang wird über 200 Läufe immer vor niedrigerem gezogen; gleicher Vorrang bleibt gemischt |
| 6 | Vorschau-Route reicht Vorrang durch, schreibt ihn in `eingabestand` | `api/matching/preview/route.ts` | Vorschau an Tag 2 zeigt Vorrang |
| 7 | Protokollzeile Vorrang | `protokoll.ts` | `protokoll.test.mjs` |
| 8 | Tresen: Anwesenheit + Mehrfach-Hinweis | `TresenClient.tsx`, `admin/page.tsx` | im Browser |
| 9 | Hinweis „wirkt nur beim Losverfahren" | `EinstellungenClient.tsx` | im Browser |
| 10 | Regressionstest Tageswechsel | `scripts/check-db.mjs` | grün |
| 11 | Seed für drei Tage, damit Generalprobe 1 nicht von Hand vorbereitet werden muss | `scripts/seed.mjs` (`--tage 3`) | `db:seed -- --tage 3`, dann `/admin` |
| 12 | Doku nachziehen | `DATENBANK.md`, `ENTSCHEIDUNGEN.md`, `TODO.md` | — |

Danach: Deploy auf Railway und Generalprobe 1 über drei Tage (Eventplan, Schritt 14).

**Aufwand:** etwa 5–7 h wie in `TODO.md` geschätzt; Schritte 3 und 5 sind der Kern,
8 und 11 das meiste Kleinzeug.

## Bewusst nicht in Phase 4

- Unscharfer Namensabgleich (Lern-Bit, verschoben)
- Vorrang für Leximin
- Wochenend-Auswertung und Export (Phase 5)
- Eine eventübergreifende Identität über Wochenenden hinweg (Arbeitsdokument, Abschnitt 16 — bewusst nicht vorgesehen)

## Offene Punkte zur Durchsicht

1. **Soll der Ausgleich am Event eingeschaltet sein?** — *entschieden 15.11.: aus.* Der Schalter steht auf
   „aus". Ohne Einschalten wirkt Schritt 3 nicht — Teilnehmerliste und Alarm
   schon.
2. **Zählt „kein Platz bekommen" auch ohne 🔥?** Im Entwurf nein: wer kein 🔥
   gesetzt hat, bekommt keinen Vorrang. Bei 15 Plätzen für 15 Personen bleibt
   ohnehin niemand ohne Platz; relevant nur, wenn eine Leitung ausfällt.
3. **Mehrfach-Hinweis nur im Tresen** oder zusätzlich in der Auslosungsvorschau?
   Entwurf: nur im Tresen.
