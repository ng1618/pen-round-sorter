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

Data currently lives in a flat JSON file (`.data/store.json`) via a small
API, or in `localStorage` for solo browser testing. Migration to SQLite on
Railway is planned next, not yet built — the persistence layer, the admin
password gate, and unguessable per-event links are all still to come.

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
