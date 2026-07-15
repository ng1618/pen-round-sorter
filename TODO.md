# TODO

## Next up: real-world usage (house event via tunnel)

- [ ] Wire up a tunnel (ngrok or Cloudflare Tunnel) so the app is reachable
      off the local WiFi, not just via LAN IP.
  - Run alongside the normal dev/prod server: `ngrok http 3000` (or
    `cloudflared tunnel`) — no code changes needed, `dataStore` already
    auto-detects "server" mode for any non-localhost hostname.
  - Free-tier tunnel URLs change on restart, so QR codes need regenerating
    per event unless a paid stable subdomain is used.
- [ ] Generate two QR codes pointing at `<tunnel-url>/dm` and
      `<tunnel-url>/rank` for people to scan at the event.
- [ ] Before an event: confirm the admin's laptop won't sleep/lock while the
      server + tunnel need to stay up.

## Worth doing before a real event

- [ ] Mobile check — every real DM/player will hit this through a QR code on
      a phone, but so far it's only been tested at desktop viewport width.
      Worth an actual pass on a phone-sized screen before relying on it.
- [ ] Confirm before re-running matching if results already exist. The
      algorithm reshuffles randomly each run — if the admin clicks "Run
      matching" twice by accident after results were already announced,
      it silently changes everyone's table with no warning.
- [ ] A simple "export data" button in admin (dump rounds/entries/assignments
      as JSON). Server mode is just one `.data/store.json` file — cheap
      insurance against a crash or restart mid-event.
- [ ] Update the favicon to match the parchment theme (still the default
      Next.js icon) — small thing, but people may bookmark/pin the tunnel
      URL on their phone.

## Smaller features, not urgent

- [ ] Let a player edit or withdraw their submitted ranking (currently
      one-shot — no take-backs once submitted). Same gap exists for DMs
      editing/deleting a round after submitting (e.g. to fix a typo).
- [ ] If a theme switcher is ever wanted, the other two directions (neon
      dice night, cabin & campfire) are still saved in the design-directions
      artifact for reference.

## Already done

- [x] localStorage-only prototype (rounds, ranking, matching, admin)
- [x] Random Serial Dictatorship matching algorithm
- [x] Match quality breakdown (1st choice / 2nd choice / unassigned counts)
- [x] Shared server-mode backend (`.data/store.json` + API routes)
- [x] Auto local/server mode detection by hostname, with manual admin override
- [x] Visual theme: tavern & parchment, with icon set A (adventure & fantasy)
      — Cinzel/EB Garamond fonts, wine red + gold palette, applied across all
      four pages
