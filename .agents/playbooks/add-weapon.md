# Playbook: add a weapon

Weapons live on the `Chain` between the players (`chain.weapons[]`, active = `chain.weapon`). Only `SawWeapon` exists and there is no switch input. Context: `.agents/context/systems/weapons.md`.

## Steps
1. **Class**: `js/weapons/MyWeapon.js`, `export class MyWeapon extends Weapon` (`super("NAME", hitThreshold)`; `hitThreshold` = extra px around the p1→p2 segment that counts as a cable hit).
2. **Implement the members the engine reads** (all optional-chained, but implement them for a full weapon):
   - `update(p1, p2)` — per sim step from `Chain.update`.
   - `drawChain(ctx, p1, p2)` (link between players) and `draw(ctx, p1, p2)` (weapon head, depth-sorted at the head's y).
   - `getSawPositions(p1, p2)` → `[{x, y, radius}]` — **must return ≥1 item**; `Game._render`, spark FX and `CombatSystem.resolveWeaponHits` index `[0]` unguarded.
   - `discRadius` (head hit radius in `resolveWeaponHits`; 0/undefined = cable-only weapon), `collisionRadius` (solid push-out radius; 0 = none).
   - `onHit()`, `setStrain(level)`, `setOnBlood(flag)`, `spinSpeed` (0..1, drives sparks and motor audio), `isHighSpeed`, `spinDir`.
   - Drop cycle: `drop(x, y)`, `pickup()`, `dropped`, `dropX/dropY/dropHover`, `updateDropped()`, `drawDropped(ctx)`, `playReconnect()`. Without `drop`, a snapped chain leaves nothing to pick up and reconnect falls back to `dist < reconnectDistance`.
3. **Hit rules** (change in `js/combat/CombatSystem.js` `resolveWeaponHits` if the weapon needs different ones): today any contact ⇒ `enemy.startDying()` (no HP), cable ignores enemies within `PLAYER_SAFE_ZONE` of a player, spin doesn't gate damage. Add a capability check (e.g. `weapon.canDamage?.()`) rather than `instanceof`.
4. **Assets**: `assets/<weapon>/...png`; load in `js/core/AssetLoader.js` (`this.load("myWeapon", "assets/myweapon/myweapon.png")` + getter).
5. **Register**: `js/Game.js` constructor: `new Chain([new SawWeapon(...), new MyWeapon(this.assets.get("myWeapon"))], {...})`. To make it selectable, call `this.chain.cycleWeapon()` from an input handler (none exists; add a key in `InputHandler`/HUD and note it in the controls docs).
6. **Audio**: cues in `js/config/AudioConfig.js` (`{ files, volume, rate, rateVariance, pitchShift, cooldownMs, maxVoices, enabled }`; loops add `loop: true`). Hit SFX is `sawHit` in `CombatSystem._playSawHit` — parameterize by weapon (e.g. `weapon.hitCue ?? "sawHit"`). A continuous loop follows the `SawMotorAudio` pattern: pure `targets(state)` function + controller over `audio.createLoopVoice("<cue>")`, updated from `Game._updateSawMotor` (per render frame). Snap/reconnect SFX are played in `Game` (`onSnap`/`onReconnect` callbacks, `_dropSawOnFall`).
7. **HUD**: `chain.name` returns `weapon.name` if a HUD shows it.

## Test
- Unit-test pure logic in `tests/test_<weapon>_*.js` (pattern: `tests/test_saw_motor_audio.js`: plain asserts, fake voice, stubbed `performance.now`, `process.exit(fails ? 1 : 0)`); run `node tests/<file>.js`.
- Keep `node tests/test_saw_motor_audio.js` green.
- In game (`python serve.py` → http://localhost:8000, or `npm start`): kills via cable and head, safe zone near players, snap (stretch past ~240 px) → drop → both players pick up, hole fall drops it, slow-mo on kill, motor/loop silent when paused or on death screen.

## Done checklist
- [ ] Class extends `Weapon`; `getSawPositions` returns ≥1 point.
- [ ] Registered in `Chain` in `Game.js`; assets loaded.
- [ ] Hit rules / SFX keyed by weapon, not hard-coded to the saw.
- [ ] Tests added and passing.
- [ ] `.agents/context/systems/weapons.md` updated (members, hit rules, audio).
