# Rendering

## Purpose

Draw the current room in crisp pixel art on a full-window 2D canvas: tiled floor/walls/props/torches, depth-sorted sprites, soft shadows, a screen-space light map with vignette, then HUD and DOM overlays. No WebGL.

## Files

- `js/core/Renderer.js` — camera (pan, zoom, shake, zoom punch, drone sway, intro zoom), world transform, room/door/front-wall tile drawing, `drawRoundShadow`.
- `js/core/Tileset.js` — draws tile `index` from a sheet (16 px cells, 10 columns).
- `js/core/AssetLoader.js` — image registry and preload (`whenReady`).
- `js/systems/LightingRenderer.js` — converts world light sources to screen space and queues them in PostProcessor.
- `js/systems/PostProcessor.js` — pixelated light map over an ambient darkness + vignette (`addLight`, `addAreaLight`, `addWash`, `addSpotLight`, `draw`).
- `js/Game.js` — `_render()` / `_renderOverlays()` define the draw order.
- `css/style.css` — `image-rendering: pixelated` on canvas and pixel-art UI.
- Config: `js/config/GameConfig.js`.

## Coordinate system

- World units are pixels. `TILE = 64` world px per tile; source art is 16 px (`Tileset(img, 16, 10)`), i.e. art pixel = 4 world px (`BLOOD_PIXEL = TILE / 16`).
- Dungeon is a grid of rooms (`GRID_COLS` 3 × `GRID_ROWS` 7). Room cell size = `ROOM_COLS` 14 × `ROOM_ROWS` 9 tiles. `WORLD_W/H` = grid × room × TILE (BloodCanvas size).
- `rooms.cellRect()` → `{x, y, w, h}` of the current room cell (`Dungeon.cellRect(gx, gy)` = `gx*cellW, gy*cellH`). Tile (col,row) top-left = `rect.x + col*TILE, rect.y + row*TILE`; center adds `TILE/2`.
- `rooms.currentBounds` / `arenaBounds` → `{minX, maxX, minY, maxY}` = cell inset by one wall tile.
- Room tile data (`rooms.currentTiles`): `{rows, cols, floor[r][c], walls[{col,row,tile,side}], props[{col,row,index,flip}], torches[{col,row,side,type}], doorCells[{col,row,index}]}`. Floor values: tileset index ≥ 0, `HOLE_TILE` (-1, auto-tiled by `holeTileFor` 4-neighbour mask → `HOLE_TILES`), `EMPTY_FLOOR_TILE` (-2, filled with `EMPTY_FLOOR_COLOR`).
- Entity `x, y` = body center; feet ≈ `y + 15..17` (shadow at `y + 17`, footprints `y + 15`).

## Camera (`Renderer`)

- `updateCamera({x, y, zoom, bounds?})`: lerp position 0.12/step toward target + drone sway; lerp zoom 0.08 toward `zoom * introZoomFactor`; optional bounds clamp (not used by Game).
- Game calls `_updateCameraToCurrentRoom` each step: target = room center, `fitZoom = min(canvas.w / (rect.w + 2*CAM_MARGIN), canvas.h / (rect.h + 2*CAM_MARGIN))` — the whole room always fits; no follow camera.
- `applyDroneSway` spring offset from average player velocity (`CAMERA_DRONE`).
- `triggerShake(amount)` (max-merge, decays ×0.88/frame, random offset), `triggerZoomPunch(amount)` (decays ×0.82/frame; negative = zoom out), `setIntroZoomFactor` (room intro).
- `_quantizeZoom`: rounds zoom so one tile is an integer number of screen px (`round(TILE*zoom)/TILE`). Translations are `Math.round`ed. This keeps pixel art seam-free.
- `beginFrame()` clears, `save()`, `setTransform(zoom, 0, 0, zoom, tx, ty)` with shake; `endFrame()` restores. `beginOverlayWorld/endOverlayWorld` = same transform without shake/punch (used for hearts above the light map).
- `worldToScreen(x, y)` → `{x, y, zoom}` (quantized, no shake) — use for all screen-space effects (lights, screen wind). `screenToWorld` uses unquantized zoom.

## Pixel-art rules

- `ctx.imageSmoothingEnabled = false` set in `Game` constructor and again after every resize (`_bindResize` sets canvas to `window.innerWidth/innerHeight`; resizing resets context state).
- CSS `image-rendering: pixelated; crisp-edges` on `#gameCanvas` and UI canvases.
- Draw sprites via source-rect crops (`cropX/cropY/cropW/cropH` within `cellSize` cells) scaled to `drawHeight`.
- Lights are drawn as blocky pixels: `LightingRenderer._lightPixel(zoom, scale) = max(2, round(TILE/16 * zoom * scale))`.
- Horizontal flip = `translate(dx + tile, dy); scale(-1, 1)`.

## Draw order

See `../architecture.md` → "`Game._render()` order" (authoritative list). Summary: background → room tiles (clipped to room + door stubs) → door stubs/gradients → floor layer (challenge floor, blood canvas minus holes, footprints, buttons, smoke) → shadows → cable → depth-sorted drawables split around the saw's Y (saw/dropped saw/sparks drawn in between) → flames → challenge walls → **front wall** (bottom tile row redrawn over entities) → gibs → air particles → world wind → lighting + post-process (screen) → heart overlay → screen wind → screen gore → door fade → HUD.

## Depth sorting

Only within one pass: `drawables = [p1, p2, ...enemies, ...challenge.buttonOccluders(entities)]` sorted ascending by `y`. Saw is inserted at `sawY = weapon.getSawPositions(p1, p2)[0].y`: entities with `y <= sawY` draw behind it. Particles, gibs, hearts, walls are fixed layers, not sorted. Anything that should overlap characters by depth must be added to `drawables` and expose `y` + `draw(ctx)`.

## Shadows

`renderer.drawRoundShadow(x, y, baseRadius, bounceFactor)`: radial gradient (alpha 0.65 → 0.35 → 0) centered at `(x, y + 17)`, radius `max(6, baseRadius - bounce*1.5)`. Players r 14 with walk bounce `|sin(animTimer)|` when `speedMag > 0.15`; visible enemies r 13; hearts have their own `drawShadow`. Drawn after floor FX and before any sprite.

## AssetLoader

- Constructor eagerly calls `load(key, src)` for every image (players + 11 expression PNGs each via `PLAYER_EXPRESSIONS`, hearts, enemies, `TINY_RPG_ENEMIES`, tileset + `tileset_1..6`, saw, rope cable, spikes `peaks0..3`, arrow traps, button, 4-frame torches/candlesticks).
- `get(key)`; convenience getters (`p1`, `tileset`, `saw`, `cable`, `peaks`, `arrowTrap`, `torchSprites`, `tilesetVariants`, …).
- `whenReady(onProgress)` resolves after every image loads, errors, or decodes. A missing file does not reject; consumers check `img.complete && img.naturalWidth > 0` before drawing (Tileset `ready`, Player, Renderer torches with tileset fallback).
- `editor.html` also constructs its own `AssetLoader`.

### Add an asset

1. Put the PNG under `assets/<group>/`.
2. In `AssetLoader` constructor: `this.load("myKey", "assets/<group>/file.png");` (relative to `index.html`).
3. Optional: add a getter. Access via `assets.get("myKey")`; pass `assets` (or the image) through the consuming subsystem's constructor.
4. For an enemy sprite sheet, add an entry to `js/config/TinyRpgEnemies.js` (auto-loaded and exposed via `ENEMY_TYPES`).
5. Electron packaging includes `assets/**/*` already.

## Config knobs (`js/config/GameConfig.js`)

`TILE`, `ROOM_COLS`, `ROOM_ROWS`, `GRID_COLS`, `GRID_ROWS`, `WORLD_W`, `WORLD_H`, `EMPTY_FLOOR_TILE`, `EMPTY_FLOOR_COLOR`, `BACKGROUND_TILE` (78), `HOLE_TILE`, `HOLE_TILES`, `holeTileFor`, `PROP_SCATTER`, `CAM_MARGIN`, `CAMERA_DRONE`, `ROOM_INTRO`, `TRANSITION_SPEED`, `DOOR_STUB_TILES`, `TORCHES` (tile `index`/`sideIndex` fallbacks, `light.*` profiles), `DOOR_LIGHT`, `PLAYER_LIGHT_RADIUS`, `LIGHT_PIXEL_SCALE`, `POST_PROCESSING` (`vignette`, `lighting.ambient`, falloffs), `WIND.layer` (`"world"` | `"screen"`). Renderer hardcodes: initial zoom 1.5, lerp 0.12/0.08, shake decay 0.88, punch decay 0.82, door gradient color `rgba(37,19,26)`, door-stub floor tile 17.

## Invariants & gotchas

- Everything between `beginFrame` and `endFrame` is in world space; lighting/post/HUD/screen gore are screen space. Convert with `renderer.worldToScreen`.
- The world pass is clipped to the room rect + `DOOR_STUB_TILES * TILE`; anything outside is invisible.
- Tile indices are hardcoded in several places (front-wall low-wall check `41..44`, door stub `17`, background `78`, torches `90/91`); changing the tileset layout breaks them.
- `T` (`Game.cycleTileset`) swaps `renderer.tileset.img` among loaded `tilesetVariants`.
- Torch animation uses `performance.now()` (real time, ignores pause/slow-mo); hit slow-mo does not slow render-only effects driven by wall clock.
- `drawFrontWall` re-draws the last floor row (skipping open south-door columns) so characters walk "behind" the bottom wall.
- `screenToWorld` and `worldToScreen` disagree slightly (unquantized vs quantized zoom); fine for background culling, not for picking.

## How to extend

- New world layer: add a `draw(ctx)` method to the owning subsystem and call it from `Game._render` at the right layer; do not draw from `update`.
- New depth-sorted object: give it `y` and `draw(ctx)` and add to `drawables` in `_render`.
- New light: add a `_renderX` method in `LightingRenderer` using `worldToScreen` + `postProcessor.addLight/addSpotLight`, call it from `render()`, put colors/falloffs in `GameConfig`.
- New full-screen effect: implement in a `systems/` class drawn after `postProcessor.draw()` (like `ScreenGore`).

## Related docs

- `../architecture.md` — full render order, subsystem ownership.
- `players-and-chain.md` — saw position used for depth split.
