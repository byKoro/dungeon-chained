# Playbook: add a trap / hazard

Hazards are room-authored elements in `cell.customHazards` (from `map/*.json` `hazards: []`), instantiated by `ChallengeCorridor`. Context: `.agents/context/systems/combat-and-entities.md`.

## Steps
1. **Entity class**: `js/entities/MyTrap.js`, plain class (traps don't extend `Entity`). Minimal contract:
   - `constructor(x, y, sprites, opts)`; store `x, y`, `cfg = opts.cfg || HAZARDS.myTrap`.
   - `update(players, deltaSeconds = 1/60)` — use **seconds** like `SpikeTrap`/`ArrowTrap` (`ChallengeCorridor.update` passes `deltaSeconds`). Damage only via `p.takeDamage(this.x, this.y)` (handles invulnerability, knockback, `lives`); skip `p.falling` if relevant.
   - `draw(ctx)` with a sprite path (`img.complete && img.naturalWidth > 0`) plus a vector fallback.
   - Optional one-frame flags (`justFired`, `justTriggered`) for Game-side SFX.
   - Optional editor knobs as `opts` (see `SpikeTrap` `timing`/`delay`).
2. **Config**: add `HAZARDS.myTrap = {...}` in `js/config/GameConfig.js` (radii, timings, draw size, colors).
3. **Assets**: frames in `assets/<folder>/` (e.g. `assets/peaks/`, `assets/arrow/`); load in `js/core/AssetLoader.js` constructor (`this.load("myTrap0", "assets/mytrap/mytrap_0.png")`) and add a getter returning the frame array (`get myTrap() {...}`, like `peaks`).
4. **Build** in `js/systems/ChallengeCorridor.js`: import the class, add an array in the constructor (`this.myTraps = []`), a `case "myTrap":` in `_build` using `this._elemWorld(el)` (tile → world), update it in `update()`, and draw it in the right layer: `drawFloorLayer` (under everything), `drawWallLayer` (after entities, before front wall), `drawAirLayer` (after gibs). Y-sorted props need an occluder like `buttonOccluders`.
5. **Audio**: add a cue in `js/config/AudioConfig.js` `cues` as `{ description, files: ["assets/audio/my-trap-01.wav"], volume, rate, rateVariance, pitchShift?, cooldownMs?, maxVoices?, enabled: true }`; play it from `Game.js` in a feedback helper modeled on `_arrowTrapFeedback(challenge)` called right after `room.challenge.update(...)` in `_updateGameplay`. Player hit SFX is automatic (`playerHit` on any life loss).
6. **Editor authoring** (`editor.html` + `js/editor/EditorApp.js`):
   - `editor.html`: add `<label class="btn tool-hazard-btn" data-hazard="myTrap"><input type="radio" name="hazard-choice" value="myTrap"> ...</label>` in the "Adicionar Trap ao Clicar" section (+ inputs for options).
   - `EditorApp._addHazardAt`: write type-specific fields onto `newHazard` (`{ type, col, row, ... }`); border tiles are rejected except for `arrow`.
   - `_hazardLabel` (list text), `_renderHazards` (preview), `_hazardTiles` (if multi-tile).
   - Bind new option inputs next to `spike-timing` handlers (~`EditorApp` "Perigos" block).
7. **Lock rule**: any hazard makes the room a challenge corridor; only `button`s (≥2) affect `Room.lockRule`. Change `Room.lockRule`/`ChallengeCorridor.solved` if the trap should gate doors.

## Test
- `python serve.py` → `editor.html` → place trap → Playtest (`index.html?playtest=true`); or save to `map/` and play at http://localhost:8000 / `npm start`.
- Check: timing at 60 Hz and in slow-mo (`HIT_SLOWMO`), damage respects invulnerability, no damage to falling players, SFX plays once per event, editor spawn-safety warning (`_checkSpawnSafety`) lists it over spawn tiles.
- Existing tests still pass: `node tests/test_safe_spawn.js`, `node tests/test_modular_grid.js`.
- Pure timing logic can get a node test in `tests/` (pattern: `tests/test_saw_motor_audio.js`, plain asserts + `process.exit(fails ? 1 : 0)`).

## Done checklist
- [ ] Class + `HAZARDS` entry + assets loaded.
- [ ] `ChallengeCorridor` builds, updates, draws it.
- [ ] Editor radio + `_addHazardAt` + label + preview.
- [ ] Audio cue + Game feedback hook (if any).
- [ ] Hazard schema documented in `.agents/context/systems/combat-and-entities.md` (Traps section).
