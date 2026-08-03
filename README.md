# Round Sorter

> 🚧 **Work in progress.** This is an active build, not a finished release —
> expect gaps, rough edges, and things that don't match this README yet.
> Built toward a real event on **20.11.2026**; development and docs are
> both still catching up to that plan as it evolves.

A small tool for splitting a group of friends into pen-and-paper (tabletop RPG)
rounds. DMs submit what they're running and how many seats they have; players
mark how keen they are on each round; an admin runs a matching pass and
everyone gets seated.

## Status

Working prototype: round submission, player preferences, Random Serial
Dictatorship matching, and an admin dashboard with a match-quality
breakdown. Styled as a tavern & parchment theme. The UI is in German.

**Preferences, not a ranked list.** Each round gets one of four levels —
🔥 must play · ✨ would like · 😐 fine either way · 😬 rather not — with at most
one 🔥 per person. A strict ordering forced people to invent a preference
between rounds they felt the same about; levels let them say so, and anything
left unmarked counts as "fine either way". Nobody is left unassignable as long
as seats remain.

**The draw.** Players are visited in random order and each takes the best round
still open to them. Two rules shape that order: ties go to the emptier table,
and people who expressed no preference at all are drawn last — but only while
seats ≥ players, where the order decides *which* table, never *whether* you get
one. Under a seat shortage that rule is dropped, so being honest about
flexibility can never cost a seat. The printed protocol states which rule
applied.

**A weekend, not a day.** One weekend holds several game days; each day starts
fresh with its own rounds and submissions, and the admin advances to the next.
The password and the printed links belong to the weekend, so QR codes stay valid
all weekend.

Data lives in **SQLite** (`.data/pen-round-sorter.db`) on the machine running
the server, reached through the API routes — every device that can open the app
sees the same state. The earlier JSON file and the browser-only mode are gone.
The admin area is password-protected, and the routes that change
anything require that login — not just the page.

**Deployed on Railway** since 02.08., with the database on a persistent volume;
survival across a redeploy is verified. Still to come: unguessable per-event
links with their QR codes.

## Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- `/dm` — DMs submit a round: name, vibe, seat count
- `/rank` — players mark how keen they are on each round
- `/admin` — draw, review, and commit a result; edit rounds; correct an
  assignment by hand; download the submissions and the protocol; start the next
  day; reset

Drawing and committing are separate steps: a draw exists only in memory until
it is committed, so a discarded draw leaves no trace. Committing writes a new
run and never overwrites an old one — a hand correction is stored as a new run
too. Both text exports work offline as a paper fallback: the submissions before
the draw, the protocol after it.

```bash
npm test        # matcher invariants, input validation, protocol text
npm run lint
npm run db:seed # sample rounds and players
```

## Docs

The build plan, decision log, data model notes, and setup details exist as
local planning docs and are intentionally not part of this public repo.
