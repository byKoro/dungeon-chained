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
   - Any accepted hit ⇒ `enemy.takeHit(1, impact)` (hp/poise/stagger live in `MeleeEnemy`, see combat-and-entities.md; common enemies have hp 1 and die), `weapon.onHit()`, game-feel feedback, one sawHit combo SFX per call. Game's `onHit` ⇒ `gameLoop.triggerHitStop()` + `sawMotor.onHit()`; Game's `onKill` (only when the hit kills) ⇒ `triggerHitSlowmo()` (`HIT_SLOWMO`). The impact point is the disc rim toward the enemy or the closest point on the cable; collision rules above are unchanged. `ThrownSaw` still calls `takeHit()` without impact info (no new feedback).
5. `GameLoop.onFrameStart` → `Game._updateSawMotor()` (per render frame, not per sim step); motor created lazily on start with `audio.createLoopVoice("sawMotor")`, exposed as `window.sawMotor`.
6. Render: `chain.drawChain` before entities; `chain.draw` between entities with `y <= sawY` and `y > sawY` (depth sort around the disc); `chain.drawDropped`.

## Config knobs
SawWeapon module constants (top of `SawWeapon.js`); Chain options in `js/config/ChainConfig.js` (`CHAIN`); forge upgrades in `js/config/ForgeConfig.js`; `PLAYER_SAFE_ZONE`, `HIT_SLOWMO` in `GameConfig.js`; motor constants at top of `SawMotorAudio.js`; cues `sawHit`, `sawSnap`, `sawLand`, `sawPickup`, `sawMotor` (loop, `volume 0.38`) in `js/config/AudioConfig.js`.

## Forge upgrades (Editor 2.0 maps, `feat/anvil-forge`)
`applySawUpgrades(forge, chain, weapon, CHAIN)` (`js/systems/ForgeState.js`) turns bought levels into parameters; `Game._applySawUpgrades` calls it after each purchase and in `newDungeon`.
- **Tamanho** (3 levels, 8/14/22): `weapon.sizeScale = 1 + 0.2·level`. `discRadius` (disc hits), `collisionRadius` and the drawn size (connected, dropped, `drawAt`) scale with it. The cable hit width (`hitThreshold` 14) does not.
- **Elasticidade** (3 levels, 8/14/22): `strainDistance` and `breakDistance` × `1 + 0.15·level`.
- **Serra dupla** (1 level, 30): `weapon.doubleSaw`. `Chain.update` feeds `weapon.setStretch(dist / breakDistance)`. At `splitAt` (0,85) the target becomes split, at `mergeAt` (0,7) whole again (hysteresis); `split` eases 0→1 over `splitSteps` (12). While split, `getSawPositions` returns two discs at t = 0,5 ∓ k/6 of the cable (1/3 and 2/3 when fully split). One-frame flags `justSplit`/`justMerged` → `Game._sawSplitFeedback` (pitched `sawLand`, shake 3, spark bursts). A dropped saw is never split. 85% of 240 = 204 px is above `strainDistance` 165, so while the saw is split (`weapon.split > 0`) `Chain.update` does not raise `strain` (it is held, not reset); only `breakDistance` snaps the cable in that band.
- `CombatSystem.resolveWeaponHits` and the saw collision in `Game._updateGameplay` loop over every saw position; the drop point (`Chain._sawCenter`) and the render split use the mean of the discs; sparks, blood pickup and the light still use `[0]`. While the saw is absent `Chain.update` returns early with `spin = 0`, so the motor stays silent; `pickup()` clears the split.
- `playReconnect(scale = 0.5)`: the first reconnect after the forge uses `SAW_CINEMATIC.firstReconnectScale` (1,1). `drawAt(ctx, x, y, { rotation, sx, sy, glow })` draws a loose disc for the cinematic.

## Pushing the dropped saw (`DroppedSawPush`, config `SAW_PUSH` in `ChainConfig.js`)
- Same eligibility as dragging, and off while `SawDrag` is active. Runs every step in `Game._updateGameplay` after the entity collisions, before wall boxes. No damage: a dropped saw never cuts.
- Body: circle `discRadius · radiusScale` (0,55). A player overlapping it is pushed back by the part the saw does not take (`share` 0,3 of the overlap moves the saw). The player's approach speed adds `transfer` (0,1) to the saw and loses `playerDrag` (0,25). While someone touches it the saw is capped at `maxSpeed` 1,6 px/step, so walking into it moves it slower than the player; released it slides with `friction` 0,88.
- Hard bump (approach ≥ `hardBumpSpeed` 6, e.g. dash/knockback): kick to `approach · kick` (max 6 px/step) for `kickSteps` 10 without the cap, shake 2.
- Each new contact at ≥ `bumpSpeed` 1,2 (cooldown 12 steps): `sawLand` at 1,7 rate / 0,22 volume, 3 sparks on the contact side, a small size pop (`dropT` back by `bumpPop`) and a `dropSpin` kick.
- The static sprite rolls: `rotation += rolled / discRadius` in the direction of horizontal travel; dust every 6 steps while it rolls fast. Walls, holes, bars, stakes, solid props (`Game._sawDragBlocked`) stop it with `wallBounce` 0,3; clamped to the arena.
- Both players reaching it still reconnect through `Chain._canReconnect` (`pickupRadius` 60 > body distance).

## Dragging the saw (`SawDrag`, Editor 2.0 maps, `feat/saw-drag`)
- Only with the saw present, the cable snapped, the saw dropped and not thrown, and not while the fresh saw sits on the anvil / the forge menu or cinematic is up (`canDrag`).
- A player within `SAW_DRAG.grabRadius` (70 px) holds their interact key for `grabSteps` (14) → attached. A tap does nothing (taps belong to chests/forge/dialogue). The prompt bar shows `drag.prompt` while someone is in range.
- While attached: that player walks at `dragSpeed[level]` (`Player.update({ speedScale })`) and cannot dash; the saw is pulled to stay within `ropeLength` (46 px, less than `CHAIN.pickupRadius` 60, so the partner arriving reconnects normally through `Chain._canReconnect`). `dropSpin = 0` (no spin; a dropped saw never cuts). The saw does not enter holes, wall boxes, bars, stakes or solid props (`Game._sawDragBlocked`) and is clamped to the arena; stretched more than `ropeSlack` past the rope, the short cable snaps.
- `traveled` (path of the saw) reaching `dragTiles[level]` tiles snaps the short cable: `sawSnap` at 1,35 rate, shake, sparks, `regrabSteps` cooldown, and the player must release the key before grabbing again. Releasing the key lets go without a snap.
- **Peso** (`FORGE.recipes.weight`, 2 levels, 10/18): drag distance 2 → 3 → 4 tiles, dragger speed 40% → 55% → 70% (`sawDragStats(forge, TILE)`). Offered by default anvils.
- Short cable drawn by `SawDrag.drawRope` right after `chain.drawChain` (placeholder: two stroked curves).

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

## Golem resistance (2026-10-29)
`ChainObstacleSystem` is constructed by Game. `beginStep(chain)` clears `weapon.obstacleContacts`; `resolve(chain,p1,p2,enemies,constrainPlayers?)` tests the curved cable (48 samples) and full disc radius against grounded immovable body ellipses. Contact displaces both players, removes inward velocity, applies friction once per enemy/step and loads the motor. Shape, friction and solver tuning: `js/config/ChainCollisionConfig.js`. Game repeats resolution after walls/clamping with a constraint callback. Infeasible pinching uses `_dropSawSafely` to disconnect and drop at a safe point. Cable geometry remains its existing curve (no wrapping).
`CombatSystem` uses recorded physical contacts for grounded immovable enemies, preserving damage at the surface without stale straight-line hits. Airborne and ordinary enemy hit rules remain. `ThrownSaw` tests solid body ellipses during substeps, rebounds and records at most one damage attempt per enemy/throw.
Regression: `tests/test_chain_obstacles.js`. Game feel/visual alignment not observed.

### Softer resistance and cutting motor (2026-10-29)
This supersedes the initial rigid resistance/motor load tuning: `CHAIN_COLLISION` now uses friction .03, inwardResistance .25, compression8, correctionStrength .25 and correctionPerStep2. Soft correction budget resets in beginStep and is shared by all resolve calls in a simulation step. Penetration beyond compression still receives hard correction to prevent crossing. Velocity reduction/friction applies once per enemy/step; lateral slide remains. Compression within tolerance is successful and cannot cause a pinch drop by itself.
`ChainObstacleSystem` no longer modifies spin. `SAW_CONTACT` in `SawWeaponConfig.js` defines minimumSpin .7, activationSpin .35, holdSteps8. SawWeapon sustains an already active motor from physical obstacle contacts or accepted enemy hits, including ordinary enemies. Drop/pickup clear hold; an idle motor never starts from contact alone. Natural deceleration resumes after contact grace ends. Thrown-saw bounce remains unchanged.
Tests: test_chain_obstacles.js. Gameplay feel not observed.

### Arauto and double-saw integration (2026-10-29)
ChainObstacleSystem samples cable separately from actual getSawPositions discs, so split mode has no phantom midpoint disc. Both real discs can resist the boss; CombatSystem preserves either-disc hits and material surface contacts. Game final boss/tether constraints reapply room props, event bars, walls and roomclamps to prevent pushing players into main's solids. Regression test_arauto_double_saw.js.
