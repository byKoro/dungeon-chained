# Visual effects & juice

## Purpose
Everything that makes hits feel heavy: pixel particles (dust, sparks, flashes, flames, blood, gibs), persistent floor gore, screen-space gore/flash, pixelated dynamic lighting (players, saw, torches, hearts, buttons, door beams), vignette, wind motes, camera shake, zoom punch, and hit slow-mo.

## Files
| File | Role |
|---|---|
| `js/particles/ParticleSystem.js` | `ParticleSystem` pools + `trigger*` API; private `AirParticle` (blood/debris arcs) |
| `js/particles/{DustPuff,SparkParticle,FlashParticle,FlameParticle,FloorDebris,Footprint,GibPiece,BloodStains}.js` | particle types |
| `js/particles/BloodCanvas.js` | world-sized offscreen canvas for permanent blood + "blood zones" |
| `js/systems/ParticleEffects.js` | player-driven effects: run/brake/walk dust, footprints, `playerStep` sound |
| `js/systems/ScreenGore.js` | screen-space red pulse (`triggerFlash`) + edge blood drops (`trigger`) |
| `js/systems/LightingRenderer.js` | converts world lights to screen lights each frame (profiles at top of file) |
| `js/systems/PostProcessor.js` | light buffer (multiply) + vignette |
| `js/systems/WindSystem.js` | drifting dust motes |
| `js/core/Renderer.js` | `triggerShake`, `triggerZoomPunch`, `setIntroZoomFactor`, `applyDroneSway`, `worldToScreen`, torch sprites |
| `js/core/GameLoop.js` | `triggerHitSlowmo`, `timeScale` |
| `js/config/GameConfig.js` | `PLAYER_LIGHT_RADIUS`, `LIGHT_PIXEL_SCALE`, `TORCHES`, `DOOR_LIGHT`, `WIND`, `POST_PROCESSING`, `HIT_SLOWMO`, `ROOM_INTRO`, `CAMERA_DRONE`, `BLOOD_*`, `MAX_FOOTPRINTS`, `MAX_ACTIVE_GIBS` |

## Juice toolbox (reuse these; all owned by `Game`)
| Call | Effect |
|---|---|
| `this.renderer.triggerShake(px)` | random offset, keeps `max(current, px)`, decays ×0.88 per render frame. Used values: 1.6 (high-speed saw, every step), 3, 4, 6, 7, 10, 14 |
| `this.renderer.triggerZoomPunch(k)` | zoom × (1+k), decays ×0.82/frame; largest magnitude wins. Positive = punch in (`0.045` door flash), negative = out (`-0.07` room cleared) |
| `this.gameLoop.triggerHitSlowmo()` / `game.triggerHitSlowmo()` | timeScale eases from `HIT_SLOWMO.minScale` (0.25) back to 1 over `duration` (0.22 s). Fired per kill (not per non-lethal hit) |
| `this.gameLoop.triggerHitStop(seconds)` | Freezes the **simulation** for `seconds` of real time, clamped to `HIT_STOP.min..max` (0.02–0.10 s); rendering, input polling, shake and the camera keep running. Max-merges (never adds), refuses new stops for `HIT_STOP.minGap` after one ends and while paused; pausing cancels it. Slow-mo and resume timers do not advance during the stop, so a kill's slow-mo plays right after it. Tier durations in `HIT_FEEL.hitStop` |
| `.triggerHitSparks(x,y,dirX,dirY,n,power,cone)` | sparks in a cone from the contact point along the hit direction |
| `.triggerHitBlood(x,y,dirX,dirY,n,spread)` | blood arcs fanned around the hit direction (stamps like `triggerBlood`) |
| `.triggerDamageNumber(x,y,amount,{color})` | floating number (`DamageNumber`, `PixelFont`, art-pixel scale `DAMAGE_NUMBER.pixel`), max `DAMAGE_NUMBER.max`; step-based like every particle; drawn by `drawDamageNumbers` in the unlit overlay pass (`Game._renderView`, with the hearts); cleared by `clear()` and on door transitions |
| `this.screenGore.triggerFlash(i=1)` | full-screen `#8a0f1a` pulse, peak capped 0.3, 20 steps |
| `this.screenGore.trigger()` | 4–7 blood drops fly in from screen edges (on enemy death) |
| `this.particleSystem.triggerDust(x,y,dirX,dirY,n)` | `DustPuff`s moving opposite to dir |
| `.triggerSparks(cx,cy,r,spinDir,n)` | tangential sparks off a disc rim (saw grind) |
| `.triggerSparkBurst(cx,cy,r,n,power)` | radial spark explosion (snap/drop) |
| `.triggerFlash(x,y,n,power)` | white glow pixels, additive (`lighter`) |
| `.triggerFlameBurst(x,y,[r,g,b],{amount,rise,width,sizeScale})` | rising additive flame pixels (enemy spawn) |
| `.triggerBlood(x,y,n,spread)` | arcing blood that stamps a splat + blood zone on landing |
| `.triggerBloodDroplets(x,y,n,spread)` | same arcs, `ephemeral` (no stamp) |
| `.triggerBloodPool(x,y,scale)` | immediate pool stamp on `BloodCanvas` |
| `this.audio.duck(db, {...})` | ambience dip that pairs with big hits (see audio.md) |
| `this.postProcessor.setVignetteBreath(0..1)` | vignette pulse; driven by chain `weapon.strain` |
| `this._triggerDoorFlash()` | `DOOR_LIGHT` spot beams for `flashDuration` + zoom punch |

Typical recipe (e.g. `onSnap` in `Game._updateGameplay`): shake + sound + duck + spark burst + flash.

Player dash (medium tier, no hit-stop: it is movement, not impact). All numbers in `PLAYER_DASH`.
- Start (`Game._dashFeedback` on `justDashed`): `playerDash` sound, `triggerShake(shake)` (2.5), backward dust cone (`dustCount`) + radial ring (`ringDust`, `Game._dustRing`) + small `triggerFlash` at the feet.
- Body (visual only, `Player.dashScale`): stretched along the dash direction by `stretch` while dashing (`_applyDashScale`: rotate → scale(s, 1/s) → unrotate, before tilt/flip). White sprite flash for `flashSteps`.
- Landing (`Game._dashLandFeedback` on `justEndedDash`, after `checkHoleFalls`, skipped if the player fell): `playerStep` at `landStepRate` (heavier), forward skid dust (`landDust`) + small ring. The sprite squashes by `landSquash` and returns with ease-out-back over `landSteps`.
- Afterimages are not particles: `Player.afterimages` (≤ `afterimages`, one every `afterimageEvery` steps, `afterimageLife` steps, keep their stretch) are drawn first in `Player.draw` as player-colored silhouettes (`afterimageTint`, `source-atop` on the per-player `_tintBuf`) at `afterimageAlpha`. At 1 ghost per step they overlap into a smear. 2 steps apart they read as distinct silhouettes.

## Key types & APIs
Particle contract (used by `updateAndCompact` in `ParticleSystem.js`): `update(a?, b?)`, `draw(ctx)`, `get done()`. Units are world px; motion is **per simulation step** (60 Hz, `SIM_STEP`), not dt-scaled. Lifetimes are in steps.
Pools: `airParticles`, `floorDebris`, `smoke`, `sparks`, `flashes`, `flames`. `update(players, bounds)` updates all of them. `clear()` empties them and also `bloodCanvas.clear()`.
`BloodCanvas` (`WORLD_W × WORLD_H`, `BLOOD_PIXEL`=4): `stampSplat`, `stampPool`, `stampFootprint`, `stampBlob`, `stampSpecks`, `addZone`, `isBloodZone(x,y)` (≤200 zones, FIFO), `draw(ctx)` (multiply, alpha 0.9).
`PostProcessor`: `addLight(x,y,radius,pixel,flatten,profile)`, `addAreaLight(...)`, `addWash(rect,dir,profile)`, `addSpotLight(x,y,dx,dy,len,spread,pixel,profile,startDist,alphaScale,startFade)`, `draw()` (clears the light list). All coordinates are **screen space**.
Light profile: `{ color: "r, g, b", flickerBase, flickerSine, flickerNoise, falloff: [{offset, alpha}] }`. Missing fields fall back to `POST_PROCESSING.lighting`.
`LightingRenderer.render({...})` adds, in order: button glows, heart lights, player lights, dropped-blade light, active-blade light, wall wash, torches (glow + area), door beams.

## Data flow
Sim step (`Game._updateGameplay`/`_updateRoomIntro`): systems call `trigger*`. Then `particleSystem.update`, `effects.update`, `wind.update`, `screenGore.update` (gameplay only).
Render (`Game._render`, inside `renderer.beginFrame()` world transform + room clip):
1. background, room, door stubs/gradients, `holes.draw`, challenge floor
2. `particleSystem.drawFloor` (BloodCanvas + debris, clipped with hole rects via even-odd) → `effects.draw` (footprints) → buttons → `drawSmoke`
3. shadows, chain, y-sorted entities split by saw y, saw, `drawSparks` (sparks + additive flashes), entities in front, `drawFlames` (additive)
4. wall layer, front wall, gibs, air layer, `drawAir` (blood arcs), wind (if `WIND.layer==="world"`)
5. `renderer.endFrame()` → `lighting.render(...)` → `postProcessor.setVignetteBreath(strain)` → `postProcessor.draw()` (ambient `41,35,53` + additive lights, multiplied over the frame; then vignette)
6. heart overlays (`beginOverlayWorld`, unlit), wind if `"screen"`, `_renderOverlays`: `screenGore.draw`, door-transition fade, `hud.draw`.

## Hole effects (`js/systems/HoleEffects.js`, config `HOLE_FX`)
- Sources rebuilt when `rooms.currentTiles` changes (clears motes): north lips and E/W rims of every hole tile.
- `dust`: ambient 1-art-px motes falling from lips (`lipRate`) and side rims (`sideRate`) per step. `crumbs`: pebbles (`bigChance` = 2 px) when a player's foot probe (`HOLE_FALL.edgeMargin + 4` px) touches a hole (`edgeRate`), plus a `fallBurst` once per fall. Both fade over `fadeDepth`, die on leaving a hole tile, capped by `maxMotes`, snapped to `pixel` (4 world px) and clipped to the hole rects.
- `drawFalling(ctx, player)`: clip = each column of the fall row's hole run, open upward and closed at the bottom of that column's hole run (only floor south of the pit hides the body); sinks `fall.sink` px (ease-out) and darkens with `ctx.filter = brightness(1 - fall.darken·t)`. `Player.draw` still does its own shrink/spin/alpha.
- `LightingRenderer._fallLightScale`: player light radius shrinks to `fall.lightMin` over the fall.

## Lighting specifics
- Player light: `PLAYER_LIGHT_RADIUS` (260 world px) × zoom, default falloff/flicker. Pixel size `_lightPixel(zoom, scale)` = `max(2, round(TILE/16 * zoom * LIGHT_PIXEL_SCALE))`.
- Torches: positions come from room data `tiles.torches` (`{col,row,side,type}`; set from map piece `torches` via `Room` `cell.customTorches`). Each torch adds a `glow` light plus an `area` light pushed `area.pushIn` into the room. `TORCHES.minPerWall/maxPerWall/marginTiles/minGap/onlyCombatRooms/sides` are not referenced by any code (probably leftovers from procedural placement). Sprites animate at 160 ms/frame in `Renderer.drawRoom` (`assets/torch/*`).
- Active saw light radius grows with `spinSpeed` (60 + 18·spin). Dropped saw breathes with `chain.getDroppedLight().hover`.
- Wall wash is disabled (`TORCHES.light.wash.enabled=false`).

## Config knobs
`POST_PROCESSING.{enabled, vignette.*, lighting.ambient/falloff/flicker*}`, `TORCHES.light.*`, `DOOR_LIGHT.*`, `WIND.*` (`count`, `layer`, `speed`, gusts, `streak`, colors), `HIT_SLOWMO`, `ROOM_INTRO.zoomFactor/times`, `CAMERA_DRONE.*`, `BLOOD_STEPS` (bloody footprints after a blood zone), `MAX_FOOTPRINTS`, `MAX_ACTIVE_GIBS`. Profile constants (`*_PROFILE`, `BLADE_COLOR`) live in `LightingRenderer.js`.

## Invariants & gotchas
- Particle speed and lifetime are step-based, so slow-mo slows them and pause freezes them. Shake, zoom punch, light flicker, vignette breath, and the HUD are **render-frame-based**, so they keep decaying while paused and run faster on high-refresh displays.
- `triggerShake` is not additive. Many small shakes in a row do not stack.
- Lights must be re-added every frame. `PostProcessor.draw()` empties `_lights`, even when disabled.
- Flames and flashes are drawn before the lighting multiply, so dark rooms dim them too. Hearts use `beginOverlayWorld` after post-processing to stay bright. Follow that pattern for anything that must look emissive regardless of light.
- `BloodCanvas` is world-sized (2688×4032) and permanent until `particleSystem.clear()` (called from `Game.newDungeon`).
- `AirParticle` blood landing calls `bloodCanvas.stampSplat` → adds a blood zone. The saw grinding over zones (`Game._updateGameplay`) spawns droplets and `weapon.setOnBlood`.
- `ParticleSystem.triggerExplosion` and `BloodCanvas.stampGib` have no callers. Gibs come from `MeleeEnemy.explodeIntoGibs()` (`GibPiece` + `BloodStains`) and are stored in `game.gibs`.
- `FlashParticle` caches glow sprites in a module-level `Map` keyed by color|size|blur. Blur is quantized, so the cache stays small.
- `ScreenGore` drops are capped at 60. `ScreenGore.update` runs only during gameplay steps (not intro/transition).

## How to extend
Add a particle class + a `trigger*` method + a pool + a draw call in the right layer. See `.agents/playbooks/add-particle-effect.md`. For a new light source, add a `_renderX` method in `LightingRenderer` with a profile constant, and call it from `render()`.

## Tests
None automated. Verify visually: `python serve.py` → http://localhost:8000 (or `npm start`). Debug keys: `T` cycles tileset, `R` restarts; `?playtest=true` uses a playtest spawn and disables door transitions.

## Related docs
`audio.md`, `ui.md`, `.agents/playbooks/add-particle-effect.md`.

## Arauto VFX and cinematic phase (2026-10-29)
- `ArautoEffects` (Game-owned; injected into CombatSystem) uses `ARAUTO_FX` in `js/config/ArautoEffectsConfig.js` for material contacts, ground impact/slam shake, dash trails and phase2 lava. `effectMaterial: lavaStone` is configured on the golem; accepted saw/throw hits emit stones/embers rather than blood. SawWeapon.onHit({blood:false}) preserves motor sustain without adding blood; player blood and ordinary enemies remain.
- `LavaFragment` lives in ParticleSystem.lavaFragments, capped180, life600steps (~10s), cooling glow90steps, fade90steps. Airborne fragments draw in drawAir, settled debris in drawFloor inside existing hole mask. Updates/clear are integrated; no BloodCanvas stamps/zones, no footprint/saw blood side effects.
- Dash snapshots are bounded6 poses/life8steps, drawn translucently behind the boss in its depth slot. No whole-screen blur. Phase2 overlay uses cached per-row/frame sprite masks, flip/anchor alignment and dark-rock palette filtering; cracks cover the body, animated bright bands flow down, droplets originate on crack pixels and fall to ground. No new hitboxes or damage.
- `justGroundHit` fires once at the configured melee/AoE impact even on miss; `justSlammed` remains one landing event. Arauto normal ground shake12, slam20; accepted player damage shake10. Renderer retains its existing decay/max merge.
- `ArautoPhaseScene` owns CinematicBars, safe transition scheduling and camera snapshot. Game marks the golem phaseTransitionControlled; phase1 remains until active attack ends. A ~3s selective state stops gameplay/players/projectiles/damage while scene particles, lava and HUD animate. At1.25s phase stats/reveal + burst, at1.85s HUD anger, at2.35s return camera/bars, by3s restore exact camera and release controls. Split view becomes one view only during scene. Reset/restart restores camera/HUD. Pause freezes scene via existing loop.
- HUD uses explicit onBossTransformation(expression|null), with cinematic expression priority; bars draw below HUD so portraits stay visible. Actual Game browser verification/captures: task2026-10-29-arauto-vfx. Human feel tuning pending.

### Arauto sound pairing (2026-10-29)
Existing ground/slam VFX now pair with dedicated stratified rock impacts and ambience duck. Dash local trail pairs with motion-only whoosh/floor scrape; saw contact pairs with spin-driven continuous metal/stone texture. See audio.md. No additional visual blast/shake increase in this task; audio is tuned first as approved.

## Arauto visual fixes (2026-10-29)
Arauto outline disabled via null (zero artPx still rounds to one pixel in MeleeEnemy); debug attack marks disabled. ArautoEffects owns full-world transient camera blur, rendered once after all views and before HUD. Attack start triggers shake/blur, charging sustains moderate shake/blur, ground/slam impacts use stronger presets. Blur decays per render and resets on dungeon reset; tuning in ArautoEffectsConfig.js. No gameplay timing changes.
