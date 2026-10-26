# hole depth

Status: in-progress
Branch: (not created yet; working tree was on feat/gamepad-ui with unrelated uncommitted work)  Base: 1cef7a6  Date: 2026-10-26

## Goal
Playtesters confused holes with floor shadow / outside-of-room void. Redraw the auto-tiled hole cells so a pit reads as a drop: lit lip, brick inner wall under the north rim, rims on the other sides, near-black core.

## Diagnosis
- Old hole fill `(23,10,15)` is within a few values of `BACKGROUND_TILE` 78 / `EMPTY_FLOOR_COLOR` / wall outline `(37,19,26)`.
- PostProcessor multiplies by ambient `41,35,53` (~0.16) outside lights, so all three collapse to ~black. No edge or face cue survived.

## Context read
- AGENTS.md, skills/create-game-assets/PROJECT-NOTES.md, context/systems/rendering.md, status.md
- js/config/GameConfig.js (`HOLE_TILES`, `holeTileFor`, `HOLE_FALL`, `POST_PROCESSING`), js/core/Tileset.js, js/rooms/DungeonTileQuery.js, js/systems/PostProcessor.js

## Steps
- [x] 1. Deterministic generator for hole cells 100..107, 109..116 in both tilesets, palette sampled from tile 0 (wall) and 16 (floor) of each sheet.
      Files: scripts/gen-hole-tiles.py, assets/tileset/tileset.png, assets/tileset/tileset_1.png
      Verify: only hole cells differ from HEAD; asset report; mock render with ambient + player lights (before-after.png)
- [x] 2. In-game check at native zoom (corridor_horizontal_ew_1, purple tileset).
- [x] 3. `HoleEffects` subsystem: ambient dust from rims, crumbs at the player's edge and on fall start, falling player clipped by the south rim + darkened + sinking, player light shrinks while falling.
      Files: js/systems/HoleEffects.js, js/Game.js, js/systems/LightingRenderer.js, js/config/GameConfig.js (`HOLE_FX`), tests/test_hole_effects.js
      Verify: npm test -- hole_effects; headless in-game stills (verification.md)

## Design
- Mask bit N (floor above): row 0 lip, 3 brick courses darkening with depth (running bond, period 8 so it tiles horizontally), dither into void.
- E/W: 1 px rim + 1 px shadow. S: 1 px rim with two chips.
- Core: void ring near rims → dithered deep → abyss. Lip row sits on the fall edge (`HOLE_FALL.edgeMargin` 8 world px = 2 art px), so art matches collision.
- Inner corners: 8-neighbour blob mask (47 cells). New corner cells 120..150 in rows 12–15 of both sheets (160x256). North corners draw the face's vertical end edge (continues the column's side rim for the face height); south corners close the L where rims meet.

## Provenance
Procedural, authored in this repo (scripts/gen-hole-tiles.py), colours taken from the existing tilesets. No external source or generated-image model.

## Docs to update when done
- [x] .agents/context/systems/rendering.md, visual-effects.md, architecture.md
- [ ] .agents/context/status.md (on merge)
