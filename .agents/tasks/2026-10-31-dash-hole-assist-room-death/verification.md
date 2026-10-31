# Verification — dash hole assist + room-scoped death

Date: 2026-10-31

## Commands run
- `npm test` → 57/59 test files pass. The only failures are pre-existing and NOT caused by this task:
  - `test_modular_grid.js` — known issue #5 (transformRoomFloor CORNER mirroring).
  - `test_arauto_effects.js` — a committed `FLAME_GOLEM.telegraph.showMarks: true` debug flag on this branch (test expects `false`). Untouched by this task.
  - `test_flame_golem.js` is flaky under the parallel runner (RNG/timing in the test); passes standalone (`node tests/test_flame_golem.js`).
- `npm run validate:map` → fails only on known issue #4 (`corridor_vertical_ns_1.json` not in `map/index.json`). No new map errors.
- `node --check` on every modified `js/` file → syntax OK.

## Focused tests added/updated (all pass)
- `tests/test_player_dash.js`: a short landing on a 2-tile gap is now rescued by the assist; added "no holeGrace ⇒ falls" and "deep middle of a 3-tile gap still falls" assertions.
- `tests/test_hole_resistance.js`: unchanged, still passes (edge resistance untouched).
- `tests/test_forge.js`: `ForgeState.setLevel` rollback + saturation.
- `tests/test_chest.js`: `ChestSystem.forgetRoom` re-opens only the given room's chests.
- `tests/test_room_scoped_death.js` (new): `RoomEvents.resetRoom` clears only the given room's completed encounters + handler state.

## Electron run (real game, `map/demo/inicial.json`, room `1,1`)
Drove `window.game` in-process under the `app://` protocol with a temporary harness
(`electron/_verify-features.cjs`, since deleted). Booted with 0 real console errors
(only the standard Electron CSP dev warning + harmless `tileset_2..6` 404s, known issue #15).
Report:
- Feature 1: a dash into a short gap during the grace window survived and landed on the
  floor tile just before the hole (`finalCol 25`, hole starts col 26). Assist works.
- Feature 2: falling with lives left respawned ~68 px from the hole centre (≈1 tile, at the
  edge), lives 3→2, not falling, and farther from the old entry spot than from the hole.
- Feature 3: full death → same room (`1,1`), respawned at the room spawn, lives refilled,
  the `size` upgrade bought in the room rolled back 1→0, scrap kept. ✓
- Note: this map's hole (cols 26–28, rows 15–16) has floor directly above (row 14) and below
  (row 17), so its middle is always within 1 tile of safe floor and the 1-tile assist rescues
  it — expected for this geometry, not the walled 3-wide synthetic case in `test_player_dash.js`.

## What was NOT verified
- No human playtest: the *feel* of the tolerance and the on-screen fade/camera were not judged by a person. The harness stepped `_updateGameplay` directly and checked state outcomes; it did not run the render pass, so the on-screen result (fade, camera jump, re-armed enemies drawn) was not visually confirmed.
- Multiplayer/co-op timing of a simultaneous double-death was not exercised live (harness set both lives to 0 in one step).
- The saw-rollback edge case (forge saw then die in that room ⇒ respawn without saw) is intended per ADR 0014; the harness exercised `size`, not `saw`.
