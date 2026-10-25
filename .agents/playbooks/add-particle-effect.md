# Playbook: add a particle effect

Context: `.agents/context/systems/visual-effects.md`.

First, check whether existing calls already cover it: `triggerDust`, `triggerSparks`, `triggerSparkBurst`, `triggerFlash`, `triggerFlameBurst`, `triggerBlood`, `triggerBloodDroplets`, `triggerBloodPool` on `game.particleSystem`, plus `renderer.triggerShake`, `renderer.triggerZoomPunch`, `game.triggerHitSlowmo()`, `screenGore.triggerFlash()/trigger()`. Composing these needs no new class.

## New particle type
1. **Class** `js/particles/EmberParticle.js` (PascalCase file = class name). Contract required by `updateAndCompact`:
   ```js
   export class EmberParticle {
       constructor(x, y, opts = {}) { /* x,y,vx,vy, life, maxLife, color */ }
       get done() { return this.life <= 0; }
       update() { /* per SIM STEP (60 Hz): integrate, apply friction, life-- */ }
       draw(ctx) { /* world space; snap to pixel grid; set ctx.globalAlpha */ }
   }
   ```
   - Pixel look: snap positions (`Math.round(x / PX) * PX`, PX=4 like `FlameParticle`/`AirParticle`) and use `fillRect`. No smoothing.
   - Lifetimes and velocities are per step, not dt.
   - Reuse cached sprites (see `getGlowSprite` in `FlashParticle.js`). Do not create canvases per particle.
2. **Pool + trigger** in `js/particles/ParticleSystem.js`:
   - constructor and `clear()`: `this.embers = [];`
   - `update()`: `updateAndCompact(this.embers);`
   - `triggerEmbers(x, y, amount = 10, opts = {}) { for (...) this.embers.push(new EmberParticle(x, y, opts)); }`
   - draw method, e.g. `drawEmbers(ctx)`, wrapped in `ctx.save()/restore()`. Use `globalCompositeOperation = "lighter"` for glowing stuff (like `drawFlames`). Return early when the pool is empty.
3. **Layer.** Call the draw method from `Game._render` at the right depth (see the render order in visual-effects.md): floor stains → `drawFloor`; ground haze → near `drawSmoke`; around the saw → near `drawSparks`; above entities → near `drawFlames`/`drawAir`. Anything that must ignore lighting goes after `postProcessor.draw()` inside `renderer.beginOverlayWorld()/endOverlayWorld()`.
4. **Trigger** from the owning event (`Game`, `CombatSystem`, `ParticleEffects` for player-driven effects). Pair it with sound and shake if it is an impact. Continuous emitters use an accumulator like `Game._sparkAccum`.
5. **Persistent marks** (stay on floor): draw into `BloodCanvas` (`stampBlob`/`stampSpecks`, or a new `stampX` method) instead of keeping particles alive. Remember `isBloodZone` side effects if you call `addZone`.
6. **Light (optional).** Add a `_renderEmbers` in `js/systems/LightingRenderer.js` with a profile constant `{ color: "r, g, b", flickerBase, flickerSine, flickerNoise, falloff }`. Convert with `this.renderer.worldToScreen` and call `postProcessor.addLight(...)` every frame. Call it from `render()` and pass the data through `Game._render`'s `lighting.render({...})`.
7. **Tuning constants.** Shared knobs go in `js/config/GameConfig.js` (UPPER_SNAKE). Local ones go at the top of the particle file.

## Verify
- `python serve.py` → http://localhost:8000 (or `npm start`). Trigger the event. Check the effect under slow-mo (kill an enemy) and while paused (should freeze).
- Devtools console has no errors. Check pool sizes: `window` has no `game` global, so add a temporary `console.log(this.particleSystem.embers.length)` and remove it afterwards. Pools must return to 0.
- Performance tab: no long frames when spamming the effect. Cap counts if needed (`while (list.length > MAX) list.shift()`).

## Done checklist
- [ ] Class follows `update/draw/done`, pixel-snapped, step-based.
- [ ] Pool added to the constructor, `clear()`, and `update()`, and drawn in the correct layer.
- [ ] Count bounded. No per-particle canvas allocation.
- [ ] Temporary logs removed.
- [ ] `.agents/context/systems/visual-effects.md` updated: toolbox table row, render order, files table.
