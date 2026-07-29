# Round Sorter

A small tool for splitting a group of friends into pen-and-paper (tabletop RPG)
rounds. DMs submit what they're running and how many seats they have; players
rank their top picks; an admin runs a matching pass and everyone gets seated.

Built for a real event on **20.11.2026** — see `Arbeitsdokument_pen-round-sorter_Block1_v2.0.md`
for the full build plan, milestones, and testing checklist.

## Status

Working prototype: round submission, player ranking, Random Serial
Dictatorship matching, and an admin dashboard with a match-quality
breakdown. Styled as a tavern & parchment theme.

Data currently lives in a flat JSON file (`.data/store.json`) via a small
API, or in `localStorage` for solo browser testing — see [`DATENMODELL.md`](DATENMODELL.md)
for the target data model and [`ENTSCHEIDUNGEN.md`](ENTSCHEIDUNGEN.md) for
why. Migration to SQLite on Railway is planned for KW32.

## Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [`SETUP.md`](SETUP.md)
for details (data modes, ports, troubleshooting).

## Usage

- `/dm` — DMs submit a round: name, vibe, seat count
- `/rank` — players rank their top rounds
- `/admin` — run the matching pass, see results, reset data

## Docs

| File | What |
|---|---|
| `Arbeitsdokument_pen-round-sorter_Block1_v2.0.md` | Master plan: milestones, weekly tasks, testing checklist |
| `SETUP.md` | Local installation and running |
| `DATENMODELL.md` | Target data model (not yet implemented) |
| `ENTSCHEIDUNGEN.md` | Decisions made, with reasoning |
| `TODO.md` | Items found during testing, not yet in the master plan |
| `NOTIZEN.md` | Parked links and ideas |
