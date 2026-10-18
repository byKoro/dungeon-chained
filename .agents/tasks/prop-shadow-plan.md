# Implementation Plan — Dynamic prop drop shadows

Goal: each decorative prop casts a dynamic silhouette shadow projected AWAY from the net light it receives. Lights = the two players and the wall torches. Shadow is a sheared/flattened copy of the ACTUAL prop tile (PNG alpha preserved — transparent pixels stay transparent), tinted dark, longer+fainter when the light is far, shorter+darker when near. Pure canvas 2D, no deps, no build step, ES module style matching the repo.

Design decisions (no design doc existed; decided here, grounded in the code read):
- Shadow is a silhouette, not an ellipse: render the tile into a reusable offscreen canvas at native 16x16, keep alpha, then tint only opaque pixels using `globalCompositeOperation = 'source-atop'` + a solid black fill. `source-atop` keeps the destination (the tile's own alpha) and paints the fill only where pixels already exist, so transparent PNG pixels remain transparent. Chosen over `source-in` because it is equally alpha-correct here and reads clearly.
- Reuse ONE offscreen buffer (`this._shadowBuf`, created lazily) across all props — no per-frame allocation, matching the perf-conscious tone of the existing renderer.
- Project with a 2D affine transform anchored at the prop's base: translate to the base anchor, then apply a matrix that shears the sprite along the shadow direction and flattens it vertically (`setTransform`/`transform`), then blit the native buffer scaled to tile size. This gives a "cast on the floor" skew that follows the light direction.
- Net light direction = sum of unit-ish vectors (light→prop) weighted by intensity `max(0, 1 - dist/radius)`; no light in range => no shadow (early return, no crash).
- Draw ALL prop shadows after `redrawHoles` + entity round shadows and BEFORE the depth-sorted `drawables` loop, so every shadow lies on the floor under all sprites, consistent with where `drawRoundShadow` is called.
- Tuning lives in a `PROP_SHADOW` config object in `GameConfig.js`, following the `TORCHES`/`PLAYER_LIGHT_RADIUS` export style. Defaults kept subtle and pixel-art friendly (image smoothing already disabled globally).

Files to change:
- `js/config/GameConfig.js` — add `PROP_SHADOW` export.
- `js/core/Renderer.js` — add `drawPropShadow(rect, p, tile, lights)` + lazy `this._shadowBuf`.
- `js/Game.js` — build `lights` array once per frame; draw prop shadows before the depth pipeline.

Verification note: this repo has no build step and no test runner (no package.json/AGENTS.md; runs by opening `index.html` or a static server, confirmed in Tileset/Renderer/Game sources). Verification is: serve the folder and visually confirm behavior + check the devtools console for zero errors. Suggested server: `python -m http.server 8000` then open `http://localhost:8000`.

---

- [ ] 1. Add the `PROP_SHADOW` tuning object to `js/config/GameConfig.js`.
      Add near the lighting section (after `TORCHES`), following the existing export/comment style. Chosen constants (subtle defaults):
      `enabled: true`, `maxLength: 1.1` (shadow length as a multiple of `tile` at farthest in-range light), `minLength: 0.35` (length multiple when light is very close), `baseAlpha: 0.33` (silhouette alpha at the darkest/closest), `minAlpha: 0.12` (alpha when light is far), `flatten: 0.42` (vertical squash of the projected silhouette; <1 = flattened onto floor), `shear: 0.9` (how far the top of the silhouette leans along the light-away direction, as a multiple of length), `minIntensity: 0.04` (ignore lights contributing less than this to the net direction), `anchorYFactor: 0.85` (prop base/footprint fraction down the tile — matches the wobble pivot `tile*0.85` in `drawPropSprite`), `color: "0, 0, 0"` (RGB of the shadow tint).
      Files: `js/config/GameConfig.js`
      Verify: open the game in a browser; console shows no module/parse error (the file is imported by Game.js). Confirm `PROP_SHADOW` is exported.

- [ ] 2. Add `drawPropShadow(rect, p, tile, lights)` and the lazy offscreen buffer to `js/core/Renderer.js`, and import `PROP_SHADOW`.
      Extend the existing import line `import { holeTileFor, TORCHES } from '../config/GameConfig.js';` to also import `PROP_SHADOW`. Implement the method:
      - Early-out if `!PROP_SHADOW.enabled`, tileset not ready, or no lights.
      - Compute prop base anchor in world: `ax = rect.x + p.col*tile + tile/2`, `ay = rect.y + p.row*tile + tile*PROP_SHADOW.anchorYFactor`.
      - Sum net light vector: for each `L` in `lights`, `dx = ax - L.x`, `dy = ay - L.y`, `dist = Math.hypot(dx,dy)`; `intensity = Math.max(0, 1 - dist/L.radius)`; skip if `intensity <= 0`. Accumulate `sumX += (dx/dist)*intensity`, `sumY += (dy/dist)*intensity` (guard `dist === 0`), and track `maxIntensity` and a weighted mean distance for length. If `maxIntensity < PROP_SHADOW.minIntensity` or the summed vector is ~0, return (no shadow). The summed vector already points light→prop, i.e. AWAY from the light.
      - Normalize the net vector to a unit direction `(dirX, dirY)`.
      - Map intensity to length and alpha: higher `maxIntensity` (closer/stronger light) => shorter + darker. Use `t = clamp(maxIntensity, 0, 1)`; `lenMul = lerp(PROP_SHADOW.maxLength, PROP_SHADOW.minLength, t)`; `alpha = lerp(PROP_SHADOW.minAlpha, PROP_SHADOW.baseAlpha, t)`. `length = lenMul * tile`.
      - Lazily build `this._shadowBuf`: an offscreen canvas (`document.createElement('canvas')`) sized to the tileset native tile (`this.tileset.tileSize`, i.e. 16x16), cache its 2D context with `imageSmoothingEnabled=false`. Reuse across calls (do NOT recreate per frame/per prop).
      - Each call: clear the buffer, draw the tile into it at native size via `this.tileset.draw(bufCtx, p.index, 0, 0, bufSize, bufSize)`, then `bufCtx.globalCompositeOperation='source-atop'`, fill `rgba(${PROP_SHADOW.color}, 1)` over the whole buffer so only opaque tile pixels get tinted, then reset `bufCtx.globalCompositeOperation='source-over'`.
      - Draw onto main ctx: `c.save()`, `c.globalAlpha = alpha`, translate to `(ax, ay)`. Build the projection: scale sprite to tile size and lean it along `(dirX, dirY)` while flattening vertically. Compose with `c.transform(...)` using a shear matrix so the silhouette's far end slides by `dirX*length*shear` / `dirY*length*flatten` (top of sprite = far end). A workable matrix: map local sprite space (0..tile wide, 0..tile tall, origin at base) through `a=scaleX`, map the sprite's "up" axis to `(dirX*length*shear, -tile*flatten + dirY*length*flatten)` so the silhouette projects outward and squashes. Honor `p.flip` by negating the horizontal sprite axis (same `scale(-1,1)` approach as `drawPropSprite`). Blit the buffer: `c.drawImage(this._shadowBuf, ...)` positioned so the sprite base sits at the anchor.
      - Always `c.restore()`; never leave `globalAlpha` or `globalCompositeOperation` changed on the MAIN ctx (composite changes only happen on the buffer ctx).
      - Keep `drawRoundShadow`, `drawPropSprite`, `drawTorchSprite` untouched.
      Files: `js/core/Renderer.js`
      Verify: open the game in a browser; no console errors. Temporarily call it for one prop (or wait for step 3) and confirm a dark skewed silhouette appears pointing away from a player.

- [ ] 3. Wire the lights array and prop-shadow pass into `js/Game.js` `_render()`.
      Import `PROP_SHADOW` by extending the existing `GameConfig.js` import block in Game.js. In `_render()`, right AFTER `renderer.redrawHoles(rect, tiles, TILE);` (and alongside the existing `drawRoundShadow` calls for players/enemies), build the world-space `lights` array ONCE:
      - Players: push `{ x: this.p1.x, y: this.p1.y, radius: PLAYER_LIGHT_RADIUS }` and the same for `this.p2`.
      - Torches: only if `TORCHES.enabled && tiles.torches && tiles.torches.length`. For each torch compute the flame world pos EXACTLY as the existing post-light block does: `wx = rect.x + t.col*TILE + TILE/2`, `wy = rect.y + t.row*TILE + TILE/2`, then `N: wy += tl.offsetY`, `S: wy -= tl.offsetY`, `W: wx += tl.offsetX`, `E: wx -= tl.offsetX` (`tl = TORCHES.light`). Push `{ x: wx, y: wy, radius: tl.radius }`.
      Then, if `PROP_SHADOW.enabled && tiles.props`, loop `for (const p of tiles.props) renderer.drawPropShadow(rect, p, TILE, lights);` — this runs before the `drawables` depth loop so shadows sit on the floor under every sprite. Do NOT alter the existing `drawables` push for props or the sort.
      Files: `js/Game.js`
      Verify: serve the folder (`python -m http.server 8000`), open the game, walk a player past scattered props: each prop shows a dark silhouette shadow leaning away from the player; near a torch the shadow leans away from the torch; between two lights the shadow follows the net direction; a prop with no light in range casts no shadow and nothing crashes. Confirm the shadow respects PNG alpha (shaped like the prop, not a rectangle) and that existing props/torches/depth ordering are unchanged. Console shows zero errors.

- [ ] 4. Pixel-art/perf sanity pass.
      Confirm `this._shadowBuf` is created once (log once or inspect in devtools), image smoothing stays disabled, and no composite-op/alpha leaks onto the main ctx (prop sprites, torches, and round shadows look identical to before). Tune `PROP_SHADOW` defaults if the effect reads too strong (lower `baseAlpha`/`maxLength`) or too flat (adjust `flatten`/`shear`).
      Files: `js/config/GameConfig.js` (tuning only, if needed)
      Verify: visual check in browser at 1.5x zoom; shadows are subtle, pixelated, and stable as the camera/players move; frame rate unchanged.

Known gaps / assumptions:
- Exact shear matrix numbers are tunable; the plan fixes the behavior (direction = away from net light, length/alpha scale with proximity, alpha preserved) and leaves final numeric feel to step 4 tuning, per "keep defaults subtle".
- Wobbling props (`p.wobbleTime > 0`) cast a shadow from their resting footprint; animating the shadow with the wobble is out of scope and would add per-frame cost — the static-footprint shadow is correct and sufficient for the stated goal.
