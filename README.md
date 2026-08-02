# Round Sorter

> 🚧 **Work in progress.** This is an active build, not a finished release —
> expect gaps, rough edges, and things that don't match this README yet.
> Built toward a real event on **20.11.2026**; development and docs are
> both still catching up to that plan as it evolves.

A small tool for splitting a group of friends into pen-and-paper (tabletop RPG)
rounds. DMs submit what they're running and how many seats they have; players
rank their top picks; an admin runs a matching pass and everyone gets seated.

## Status

Working prototype: round submission, player ranking, Random Serial
Dictatorship matching, and an admin dashboard with a match-quality
breakdown. Styled as a tavern & parchment theme.

Data lives in **SQLite** (`.data/pen-round-sorter.db`) on the machine running
the server, reached through the API routes — every device that can open the app
sees the same state. The earlier JSON file and the browser-only mode are gone.
The admin area is password-protected, and the routes that change
anything require that login — not just the page.

Hosting on Railway is planned next and not yet built, and so are the
unguessable per-event links with their QR codes.

## Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- `/dm` — DMs submit a round: name, vibe, seat count
- `/rank` — players rank their top rounds
- `/admin` — run the matching pass, see results, reset data

## Docs

The build plan, decision log, data model notes, and setup details exist as
local planning docs and are intentionally not part of this public repo.
