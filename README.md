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

**The draw.** The default is a lottery (random serial dictatorship): players are
visited in random order and each takes the best round still open to them. Two
rules shape that order — ties go to the emptier table, and people who expressed
no preference at all are drawn last, but only while seats ≥ players, where the
order decides *which* table, never *whether* you get one. Under a seat shortage
that rule is dropped, so being honest about flexibility can never cost a seat.

A second method, **leximin**, can be selected instead: it minimises in turn how
many end up with no seat, then how many land on their worst level, then the next
worst. It only helps when seats are tight — measured over 3,000 runs it is
identical to the lottery in the planned setup, and reaches 8.0 instead of 6.2
granted top wishes when a GM drops out. It is **not strategy-proof**, which is
why the lottery stays the default and the protocol records which method ran.

After a draw the admin can also run a **swap round** (top trading cycles): it
finds rotations where nobody ends up worse and at least one person better, while
each round keeps exactly the same number of people. A fresh lottery result has
nothing to swap — that is the confirmation, not a shortcoming.

**A weekend, not a day.** One weekend holds several game days; each day starts
fresh with its own rounds and submissions, and the admin advances to the next.
The password and the links belong to the weekend, not the day, so the QR codes
stay valid all weekend.

Data lives in **SQLite** (`.data/pen-round-sorter.db`) on the machine running
the server, reached through the API routes — every device that can open the app
sees the same state. The earlier JSON file and the browser-only mode are gone.
The admin area is password-protected, and the routes that change
anything require that login — not just the page.

**It runs on a laptop on the local network** — `npm run build && npm run start`,
reached over that machine's LAN address. That is the main path as of 01.09., not
a fallback: everyone is in the same house and the QR codes are scanned off the
screen, so a public address was convenience rather than a requirement. Hosting
(Railway, verified on a persistent volume on 02.08.) stays configured as a *paid*
fallback, brought up in the week before the event. Testing from outside the
network goes through a throwaway tunnel; the codes carry whatever address the
request arrived on, so a changing tunnel URL costs nothing. See `SETUP.md`,
section „Betriebsarten". Still to come: unguessable per-event links with their
QR codes.

## Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- `/dm` — DMs submit a round: name, vibe, seat count
- `/rank` — players mark how keen they are on each round
- `/admin` — the counter: state of the day, **one** next step, rounds and
  players
- `/admin/auslosen` — draw → review → commit → result; correct by hand, run a
  swap round, adjust a round's seats after talking to its GM, download the
  protocol
- `/admin/einstellungen` — name the weekend, set the number of days, pick the
  method; resetting the day lives at the bottom
- `/codes` — two QR codes to hold up, one per audience

Drawing and committing are separate steps: a draw exists only in memory until
it is committed, so a discarded draw leaves no trace. Committing writes a new
run and never overwrites an old one — a hand correction is stored as a new run
too. Moving someone into a full round is allowed; the round is marked as
over capacity and committing stays blocked until that is resolved. Both text
exports work offline as a paper fallback: the submissions before the draw, the
protocol after it.

```bash
npm test        # 70: matcher invariants, leximin, swap round, assignment
                #     solver, input validation, protocol text, base URL
npm run db:check # 14 acceptance checks against a throwaway database
npm run lint
npm run db:seed # sample rounds and players
```

## Docs

The build plan, decision log, data model notes, and setup details exist as
local planning docs and are intentionally not part of this public repo.
