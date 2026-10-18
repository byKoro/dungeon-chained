# Dynamic projected prop shadows

Each decorative prop now casts a dynamic drop shadow projected away from the net light it receives. The light set is built once per frame from the two players and every wall torch, and each prop's silhouette is reprojected onto the floor via an affine transform anchored at the prop's foot, leaning and offsetting in the direction opposite the summed light. The silhouette is produced from the prop's own tile through a single reusable offscreen buffer tinted with a `source-atop` composite, so the PNG alpha is preserved and transparent pixels stay transparent (no square box). Shadows are drawn under all sprites, between `redrawHoles` and the depth pipeline, and the whole thing is gated by a `PROP_SHADOW` config block with subtle defaults. The diff also carries unrelated work: a depth-sort pipeline for props/torches, side-wall redraw, torch flame wobble, torch sparks, earth-dust on prop step, and a wall-top climb tweak.

Watch for: no verification evidence was recorded for an uncommitted change (confirmed) — see the gating note below; the shadow light math and alpha handling themselves are correct (confirmed).

**Verdict**: APPROVED

## High-level view

The net-light direction is a weighted sum of unit vectors pointing from each light toward the prop, i.e. away from the light, which is exactly the direction a cast shadow should fall. Weights are `max(0, 1 - dist/radius)`, and the summed vector is normalized by the sum of weights to measure directional agreement, so lights arriving from many sides cancel and fade the shadow out instead of producing a spurious direction. This is the right model and the signs are correct.

Alpha preservation is handled by drawing the actual prop tile into a 16x16 offscreen buffer and tinting with `globalCompositeOperation = 'source-atop'`, which paints the fill only where the tile already has opaque pixels. Transparent pixels remain transparent, so the shadow is a true silhouette rather than an ellipse or a box.

Main-context state is saved and restored around the one `drawImage`, and the composite op on the offscreen buffer is reset to `source-over` after tinting. The buffer is created once and cached on the renderer, so there is no per-frame allocation.

The torch flame positions used to build the shadow light set are computed with the same center-plus-offset formula the post-processor already uses for the visible torch light, so shadows agree with the lights the player sees. The existing `drawPropSprite`, `drawRoundShadow`, torches, and depth ordering are preserved; shadows are additive and drawn under the sprites.

The one real gap is process, not code: this is an uncommitted change with no commit message or task report, so there is no recorded verification evidence (manual playtest, screenshot, console-clean note) for a change that is almost entirely visual.

<details>
<summary>Issues (1)</summary>

1. **No verification evidence recorded** — the change is uncommitted with no commit message or task report, so there is no coder-recorded playtest/visual confirmation for a visual-only feature. Non-blocking given the static-analysis review, but a manual playtest note should accompany the commit.

</details>

<details>
<summary>Details</summary>

## Net-light direction and the "away from light" guarantee

For each light the code takes `dx = ax - L.x`, `dy = ay - L.y` (prop anchor minus light position), which already points from the light toward the prop — the direction a shadow falls. Each contribution is the unit vector `(dx/dist, dy/dist)` scaled by `intensity = max(0, 1 - dist/radius)`, accumulated into `(sumX, sumY)` with `sumWeight` tracking the total intensity. The shadow direction `(dirX, dirY) = (sumX, sumY)/sumLen` is therefore the intensity-weighted average of the away-from-light directions. One light directly to the left of a prop pushes the shadow right; two symmetric lights cancel. The sign convention is correct throughout.

`dirMag = sumLen / sumWeight` is in `[0,1]` and measures how much the lights agree on a direction: near 1 when they come from the same side, near 0 when they surround the prop. It drives `dirFade = clamp01(dirMag / minDirMagnitude)`, so an ambiguous omnidirectional light sum fades the shadow to nothing rather than snapping to a jittery direction. `strongLightFade` separately drops opacity as total illumination rises. Both are the right instincts for a multi-light scene.

## Alpha-preserving silhouette

```js
bc.clearRect(0, 0, bufSize, bufSize);
this.tileset.draw(bc, p.index, 0, 0, bufSize, bufSize);
bc.globalCompositeOperation = 'source-atop';
bc.fillStyle = `rgba(${PROP_SHADOW.color}, 1)`;
bc.fillRect(0, 0, bufSize, bufSize);
bc.globalCompositeOperation = 'source-over';
```

The tile is drawn at native 16x16 (`this.tileset.tileSize`), then `source-atop` restricts the solid fill to pixels that already have coverage from the tile. Transparent PNG pixels receive no fill and stay transparent, so the projected shape is the prop's true outline. The buffer is cleared each call before redraw, so stale pixels from a previous prop can't bleed through. The composite op is reset to `source-over` immediately, leaving the buffer context clean for the next prop.

## Offscreen buffer lifecycle and main-context state

The buffer is lazily created once and cached as `this._shadowBuf` / `this._shadowBufCtx` with smoothing disabled, so there is no per-frame canvas allocation regardless of prop count. On the main context, `c.save()` precedes the `globalAlpha` set, the `translate`, and the `transform`, and `c.restore()` follows the single `drawImage` — so neither `globalAlpha` nor the composite op nor the transform leaks out to subsequent draws. The main context's composite op is never touched here (only the offscreen buffer's is), which is the correct separation.

## Projection transform

With the context translated to the foot anchor `(ax, ay)`, the affine map is

```
transform(sx, 0, -upX/bufSize, -upY/bufSize, offX+upX, offY+upY)
```

Evaluating buffer coords `(bx, by)`: at `by = bufSize` (sprite base) the point lands at `(sx*bx + offX, offY)` — the base sits at the anchor plus the away-from-light offset. At `by = 0` (sprite top) it lands at `(sx*bx + offX + upX, offY + upY)`, so the top is displaced by `(upX, upY)` relative to the base. `upY = -tile*flatten + dirY*length*shear` is negative (the silhouette rises), with a subtle lean toward the shadow direction scaled by `shear`. The flip is honored by negating `sx`. The math produces a short, slightly sheared, flattened silhouette offset away from the light — matching the stated design (a displaced silhouette, not a long stretched trail).

## Torch light agreement

The shadow light set builds each torch flame position as `rect.x + t.col*TILE + TILE/2`, `rect.y + t.row*TILE + TILE/2`, then nudges by `tl.offsetY` / `tl.offsetX` per side (`N` +y, `S` -y, `W` +x, `E` -x) using `TORCHES.light`. This is byte-for-byte the same formula the post-processor uses when it registers the visible torch light later in `_render`. Shadows therefore fall consistent with the lights the player sees. Player lights use `PLAYER_LIGHT_RADIUS`, matching the player light source.

## Preserved pipeline and ordering

Shadows are emitted after `drawRoom` and `redrawHoles` and before the depth-sorted sprite pass, so they sit on the floor beneath every entity and prop sprite. `drawPropSprite`, `drawRoundShadow`, and the torch sprites remain intact; the props/torches that were formerly drawn flat in `drawRoom` now flow through the depth pipeline, and side (E/W) torches plus side walls are redrawn on top afterward. The shadow pass reads the prop list but does not mutate it, and runs under the same `PROP_SHADOW.enabled && tiles.props.length` guard as the loop.

## Tuning constants

`PROP_SHADOW` exposes `maxLength`/`minLength` (offset as a multiple of TILE), `shear`, `flatten`, `baseAlpha`/`minAlpha`, `minIntensity`, `anchorYFactor`, `minDirMagnitude`, `strongLightFade`, and `color`, each documented. Defaults are subtle (base alpha 0.3, offsets 0.18–0.45 tiles, flatten 0.7). `anchorYFactor` 0.85 matches the wobble pivot in `drawPropSprite`, keeping the shadow rooted at the same foot the sprite rotates around.

## Verification evidence

The feature is entirely uncommitted (`git status` shows modified `Renderer.js`, `Game.js`, `GameConfig.js` and others, plus untracked `EarthDust.js`/`TorchSpark.js`), with no commit message and no task-state report in `.agents/tasks/`. For a visual-only change the meaningful verification is a manual playtest / screenshot and a clean console, and none is recorded. The code review above finds the implementation correct, so this is flagged as a non-blocking process gap rather than a code defect: a playtest confirmation should accompany the eventual commit. The project is a static ES-module canvas game with no build step, so there is nothing to compile.

## Bundled unrelated changes

The diff mixes the shadow feature with several independent changes: the prop/torch depth-sort pipeline and `PROP_FRONT_PIXELS`/`TORCH_FRONT_PIXELS`/`PROP_SORT_FOOT_OFFSET`, `drawSideWalls`, `redrawHoles` plus the blood-vs-hole reordering, `WALL_TOP_CLIMB`, torch flame wobble (`drawTorchSprite`), torch sparks and earth-dust particles, and `EditorApp`/`RoomManager`/`ParticleSystem` edits. These are out of scope for this shadow review and appear coherent in passing, but reviewers should note they ship together.

</details>

<details>
<summary>File map</summary>

- `js/core/Renderer.js` — adds `drawPropShadow` (the feature), plus `drawPropSprite`, `drawTorchSprite`, `redrawHoles`, `drawSideWalls`; removes flat prop/torch draw from `drawRoom`.
- `js/config/GameConfig.js` — adds `PROP_SHADOW` config block, depth-sort/`WALL_TOP_CLIMB` constants, torch wobble/particles.
- `js/Game.js` — builds the per-frame light set and calls `drawPropShadow`; adds depth pipeline, prop interactions, torch particles.
- `js/particles/ParticleSystem.js`, `js/particles/EarthDust.js`, `js/particles/TorchSpark.js` — particle additions (unrelated).
- `js/editor/EditorApp.js`, `js/rooms/RoomManager.js`, `assets/peaks/*.png`, `.gitignore` — unrelated.

Full diff: `git diff HEAD` (changes are uncommitted on branch `hole`).

</details>
