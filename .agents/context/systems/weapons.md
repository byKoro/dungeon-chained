# Weapons (the chained saw)

## Purpose
The only weapon is a saw disc riding the midpoint of the cable that chains P1 and P2. Moving together spins it up; the cable and disc kill enemies. The cable can snap (over-stretch or a hole fall) and the saw is then dropped on the floor until both players pick it up.

## Files
- `js/weapons/Weapon.js` — `Weapon` base.
- `js/weapons/SawWeapon.js` — `SawWeapon extends Weapon` (spin, cable sag, drop/pickup, drawing).
- `js/weapons/SawMotorAudio.js` — `motorTargets(spin, state)` pure mapping + `SawMotorAudio` controller.
- `js/core/Chain.js` — `Chain` owns `weapons[]`, connection/strain/snap/reconnect, and delegates draw/update to `chain.weapon`.
- `js/combat/CombatSystem.js` — `resolveWeaponHits` (hit detection).
- `js/core/LoopVoice.js` / `js/core/AudioManager.js` — `audio.createLoopVoice("sawMotor")` voice used by the motor.
- `js/Game.js` — constructs `new Chain([new SawWeapon(assets.saw, assets.cable)], {...})`, `_updateSawMotor`, `_dropSawOnFall`, spark/blood FX, render order.
- Assets: `assets/saw/saw.png` (key `saw`), `assets/saw/rope.png` (key `cable`).

## Key types & APIs
**`Weapon(name, hitThreshold=22)`**: `update()`, `drawChain(ctx,p1,p2)`, `draw(ctx,p1,p2)`, `hitsTarget(target,p1,p2)` (segment distance). `hitsTarget` is not called anywhere in the game loop.

**Optional duck-typed members** consumed by `Chain` / `CombatSystem` / `Game` (all guarded with `?.`/`??`): `getSawPositions(p1,p2) → [{x,y,radius}]`, `discRadius`, `collisionRadius`, `spinSpeed`, `isHighSpeed`, `spinDir`, `onHit()`, `setOnBlood(bool)`, `setStrain(0..1)`, `drop(x,y)`, `pickup()`, `dropped/dropX/dropY/dropHover`, `updateDropped()`, `drawDropped(ctx)`, `playReconnect()`.

**`SawWeapon(sprite, cableSprite)`** — `super("SERRAS", 14)` ⇒ `hitThreshold = 14`.
- `update(p1, p2)`: target spin = `min(p1.speedMag, p2.speedMag) / speed` (both must move); lerp up `SPIN_ACCEL 0.045`, down `SPIN_DECEL 0.012`; cable drag offset from mean player velocity (`CABLE_DRAG_GAIN 7`, max 46 px); `spinKick` when crossing `BLEND_HI 0.6`; blood tint timer `BLOOD_DURATION 90` frames (refreshed by `onHit` or while `onBlood`).
- `cablePoint(p1,p2,t)`: quadratic sag `4t(1-t)` × drag. `getSawPositions` returns one disc at `t=0.5`, `radius 14`.
- `discRadius` = `SAW_DRAW_LARGE/2` ≈ 32.2 px; `collisionRadius` = `discRadius*0.5` (physical push-out radius for players/enemies in `Game._updateGameplay`).
- `isHighSpeed` = spin > 0.6 (Game adds constant small shake).
- Drawing: sprite sheet 16 px frames, 4 cols; rows 0/1 inertia clean/bloody, 2/3 spin clean/bloody; cross-fade between rows for spin 0.35–0.6; strain flash (`setStrain`), reconnect pop/blink (`playReconnect`, 42 frames). `drawChain` tiles `rope.png` along 48 sub-segments scrolled by `textureOffset`. `drawDropped` hovering disc + shine beam.

**`Chain`** (`rest 130, stiffness 0.02`, defaults `breakDistance 240`, `strainDistance 165`, `strainLimit 30`, `reconnectDistance 110`, `pickupRadius 60`, `reconnectDelay 20`): snaps when `dist > breakDistance` or strain frames ≥ limit → `weapon.drop(resolveDropPoint(...))` + `events.onSnap`. Reconnect: if weapon `dropped`, both players within `pickupRadius` of drop point; else `dist < reconnectDistance`. `forceDrop` (hole fall). `cycleWeapon()` exists but nothing calls it. `applyToEnemies` duplicates the hit logic and is unused.

**`SawMotorAudio(voice)`**: `update(spin, {connected, active, timeScale})` → `voice.set(motorTargets(...), tau)`; `onHit()` pitch-dip pulse (merged within 40 ms, ignored when spin < 0.15); `onSnap()` strong dip; `stop(fadeMs)`. `motorTargets`: level `spin^1.5` (0 below 0.02), ×0.8 when dropped, 0 when inactive; rate 0.5→1.0 with spin, lowered up to 20 % in slow-mo; low-pass cutoff 700 Hz→18 kHz. Voice null ⇒ every method is a no-op.

## Data flow
1. `Game._updateGameplay`: `chain.update(p1, p2, {onSnap, onReconnect, resolveDropPoint})` → `weapon.setStrain`, `weapon.update`, `updateDropped` if disconnected.
2. Game computes sparks from `spinSpeed × team speed`, sets `setOnBlood` from `bloodCanvas.isBloodZone(saw)`.
3. Saw disc is a solid circle (`collisionRadius`) in `Physics.resolveCircleCollision` for players + live enemies.
4. `combat.resolveWeaponHits(chain.weapon, enemies, p1, p2, chain.isConnected, onKill)`; nothing happens if disconnected. Per non-dying enemy:
   - **cable hit**: `Physics.distToSegment(enemy, p1→p2) < weapon.hitThreshold + enemy.hitRadius` AND enemy farther than `PLAYER_SAFE_ZONE` (46) from both players (note: straight segment, not the sagging drawn cable);
   - **disc hit**: distance to `getSawPositions()[0]` < `discRadius + enemy.hitRadius` (no safe-zone exemption).
   - Spin speed does **not** gate damage — a still saw kills too.
   - Any hit ⇒ instant `startDying()` (no enemy HP), `weapon.onHit()`, sawHit combo SFX; Game's onKill ⇒ `triggerHitSlowmo()` (`HIT_SLOWMO`) and `sawMotor.onHit()`.
5. `GameLoop.onFrameStart` → `Game._updateSawMotor()` (per render frame, not per sim step); motor created lazily on start with `audio.createLoopVoice("sawMotor")`, exposed as `window.sawMotor`.
6. Render: `chain.drawChain` before entities; `chain.draw` between entities with `y <= sawY` and `y > sawY` (depth sort around the disc); `chain.drawDropped`.

## Config knobs
SawWeapon module constants (top of `SawWeapon.js`); Chain options in `Game` constructor; `PLAYER_SAFE_ZONE`, `HIT_SLOWMO` in `GameConfig.js`; motor constants at top of `SawMotorAudio.js`; cues `sawHit`, `sawSnap`, `sawLand`, `sawPickup`, `sawMotor` (loop, `volume 0.38`) in `js/config/AudioConfig.js`.

## Invariants & gotchas
- Code assumes `getSawPositions(...)[0]` exists whenever the method exists (Game render and FX index `[0]` without checks).
- `Game._render` calls `getSawPositions` even while disconnected (for draw sorting).
- `Chain.playerSafeZone` and `PLAYER_SAFE_ZONE` are separate copies (both 46).
- Only `chain.weapons[0]` is ever active; there is no weapon-switch input.
- Motor audio intentionally lives outside the fixed-step sim; tests stub `performance.now`.

## How to extend
See `.agents/playbooks/add-weapon.md`.

## Tests
`node tests/test_saw_motor_audio.js` — `motorTargets` monotonic/limits and `SawMotorAudio` pulse merging with a fake voice (35 asserts). No tests for `SawWeapon`/`Chain`/hit detection; verify in game (`python serve.py` → http://localhost:8000, or `npm start`).

## Related docs
`combat-and-entities.md`, `.agents/playbooks/add-weapon.md`.
