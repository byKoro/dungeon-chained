# Verification — botas room: dash pickup + 5 upgrades + cinematic + card

Date: 2026-10-31

## Commands
- `node --check` on every modified/new js file → syntax OK.
- `npm test` → 59/62. The only failures are pre-existing and NOT from this task:
  - `test_arauto_effects` (committed `FLAME_GOLEM.telegraph.showMarks: true` debug flag on this branch),
  - `test_modular_grid` (#5),
  - `test_arauto_das_brasas` (flaky under the parallel runner; passes standalone — confirmed).
- New/updated focused tests pass: `test_player_dash` (39, incl. speed/charges/cooldown), `test_dash_push` (8),
  `test_coop_heal` (11), `test_ability_card` (9), `test_saw_upgrades` (22, catalog updated).
- `npm run validate:map` → fails only on the pre-existing #4 (`corridor_vertical_ns_1.json` unlisted). inicial.json
  is a demo map (not a catalog piece), so the recipe swap doesn't affect map validation.
- `python scripts/gen-boots.py` → wrote assets/boots/boots.png (16x16 placeholder).

## Electron run (real game, `app://`, temp harness, since deleted) — 0 console errors
Booted, teleported to the botas room (cell 0,1, name "botas"). Report:
- `anvilRecipes` = [moveSpeed, dashPush, coopHeal, dashCooldown, dashCharges] (the 5 new; inicial-room anvil keeps the saw default).
- `dashBefore: false`, `bootsPresentBefore: true` — dash locked, boots floating over the anvil.
- Walking a player onto the boots: `collected: true`, `dashAfter: true` (dash granted), `cardActive: true` (tutorial card shown), `bootsPresentAfter: false` (boots consumed).
- Buying `moveSpeed`: `speedMult 1 → 1.08`. Buying `dashCharges`: `dashMaxCharges 2`.

## What was NOT verified
- No human playtest: the feel of the five upgrades (speed bump, push strength, heal timing, cooldown, chaining dashes),
  the entry camera tour (pan cadence/holds), the card's on-screen look, and the boots float/pop visuals were not judged
  by a person. The harness drove state and checked outcomes; it did not run the render pass, so the cinematic, card and
  boots sprite were not seen on screen (only the boots PNG preview via gen-boots.py --preview would show the art).
- Sequencing caveat (flagged): the botas room has authored enemies, so the generic room intro plays first and the boots
  camera tour runs when gameplay resumes; enemies may act during the ~2s tour. Needs a playtest to judge.
- The boots placeholder art is programmer pixel-art, to be replaced.
