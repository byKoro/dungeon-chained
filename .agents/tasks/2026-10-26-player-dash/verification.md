# Verification: player dash

## Commands run
- `node tests/test_player_dash.js`: 29/29. Covers:
  - gating (chain, knockback, fall, feet in hole) and key edge
  - pause latch
  - distance/duration/exit speed, direction and fallback
  - cooldown, i-frames without blink
  - respawn reset, `cancelDash`
  - 1-tile crossing, 2-tile never, immediate fall at the end, no pushback while dashing
- `node tests/test_hole_resistance.js`: 12/12. Hole behaviour is unchanged when not dashing.
- `npm run check`: tests 8/9, map 1 error. Both failures are pre-existing (`status.md` #5 `test_modular_grid`, #4 `corridor_vertical_ns_1.json`). Docs drift OK, graph updated.
- Headless Chrome smoke (temporary `_tmp_dash_smoke.*` at the repo root, deleted afterwards; screenshots in `_local/dash_smoke_*.png`):
  - Boot: no page errors, only the known `tileset_2..6` 404s (#15) and favicon.
  - Chain dropped via `chain.forceDrop`, then a P1 dash up. 3 afterimages are visible mid-dash and P1 moved 133.5 px (dash + exit slide). The HUD bar is empty mid-dash, half full at cooldown 30, and P2's bar is full.
  - Pause resumed with Enter held: P2 did not dash.
  - Space right after death did not restart. After 600 ms (focus moved away from the death button) it restarted.

## Not verified
- Real keyboard and gamepad feel (A/RB on a physical pad), and audibility/mix of the `playerDash` placeholder.
- Hole jump in a real authored room (only the synthetic grids in the tests).
- Dodging an actual enemy swing / arrow / spike in combat (only `takeDamage` in tests).
- Electron build.
- Visual quality of the afterimage tint. It looked like a light trail mixed with the dust in the screenshot; tuning may be wanted.

## Juice pass (game-feel, 2026-10-26)
- Added start shake 2.5 + dust cone/ring + flash, a sprite stretch along the dash with a white flash, and a landing squash with ease-out-back, skid dust and a heavier footstep. Afterimages became solid silhouettes, 4 of them, 2 steps apart. Numbers are in `PLAYER_DASH`.
- Headless Chrome screenshots of start / mid / landing (shake stubbed out for stable frames): `_local/juice2_strip.png`. No page errors. At 1 ghost per step the trail was a smear, so I spaced the ghosts out to 2 steps.
- `npm run check`: same 2 pre-existing failures only. `test_player_dash` 29/29.
- Not verified: shake strength and footstep layering in a live session with sound.

## Dash bar art pass (create-game-assets, 2026-10-26)
- Art direction: reuses the existing UI system. Chamfered stone frame (`FRAME` from `PixelButton.js`), well and segmented cells with spec/dark rows from `LoadingScreen`, hard 1 px outline, drop shadow bottom-right like the hearts. P1 cells use the existing `FACES.gold` ramp, P2 a matching blue ramp. Integer scale `hs`, smoothing off.
- Provenance: drawn in code (`DashBar._render`, `js/ui/VtuberHud.js`). No new image files or external sources.
- Verified in headless Chrome at 1280×720 (screenshots `_local/bar_strip.png`, `_local/bar2_zoom.png`):
  - ready, charging (2 cells + partial) and full-again states render for both players, P2 mirrored with the shadow still bottom-right
  - no page errors
  - the first glyph (double chevron) read as a checkerboard at 3 px, so I replaced it with `-▸`
- Not verified: other resolutions (HUD `hs` changes with window size), the pop/glint animation timing in motion (only stills), and `prefers-reduced-motion`.
