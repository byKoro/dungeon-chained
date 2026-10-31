# Players & Chain

## Purpose

Two local players ("Amarelo" P1, "Azul" P2) are tethered by an elastic cable carrying a circular saw at its midpoint. Moving together sweeps the saw through enemies. Overstretch snaps ("arrebenta") the cable: the saw drops on the floor and both players must walk back to it to reconnect. Losing all lives on either player ends the run.

## Files

- `js/entities/Entity.js` — base: `x, y, vx, vy, hitRadius, facingLeft, animTimer`, `speedMag` getter, `update()` integrates velocity.
- `js/entities/Player.js` — movement, damage, falling, sprite selection, draw.
- `js/entities/PlayerFactory.js` — builds both players from `playerConfigs(assets)`.
- `js/config/EntityConfig.js` — `playerConfigs(assets)`: color, controls, sprite sheets.
- `js/core/Chain.js` — tether constraint, strain, snap, drop, reconnect; wraps a weapon list.
- `js/weapons/SawWeapon.js` (extends `Weapon.js`) — saw position (`getSawPositions`), cable drawing, drop/pickup visuals, spin.
- `js/core/Physics.js` — `applyChainConstraint`, entity/circle/box collision.
- `js/core/InputHandler.js` — keyboard + gamepad to a key set.
- `js/systems/PlayerAI.js` — debug bot for P1.
- `js/rooms/DungeonTileQuery.js` — hole falls, safe spawn, saw drop points.
- Orchestration: `js/Game.js` (`_updateGameplay`, `_resolveFall`, `_dropSawOnFall`, `_updateHearts`, `enforceSeparationLimit`, `newDungeon`, `transitionThroughDoor`).

## Key types & APIs

**Player** (`new Player(x, y, color, controls, spriteImg, name, spriteConfig)`)
- `hitRadius` 16 (from `Entity`), `speed` 4.2 px/step, `lives` 3.
- `controls` = `[up, down, left, right]` key names; `handleInput(input)` reads `input.isDown(key)`. Diagonal normalized (×0.7071). Velocity lerp: `v = v*0.76 + dir*speed*0.24`; release decel 0.76 (0.90 during post-run slide `slideTimer`).
- `takeDamage(srcX, srcY)` → `false` if `falling` or `invulnerableTimer > 0`; else `lives--`, invuln 65 steps, `hurtTimer` 30, `scaredTimer` 120, knockback 16 px/step. Returns `true` on hit. Callers: `MeleeEnemy`, `ArrowTrap`, `SpikeTrap`.
- `startFalling(cx, cy)` / `respawnAt(x, y, invulnFrames)`; fields `falling`, `fallComplete`, `fallTimer` (34 steps), `holeGrace` (set to `HOLE_FALL.dashGraceSteps` when a dash ends, decremented each non-dashing step; read by `DungeonTileQuery.checkHoleFalls` for the dash landing assist).
- Per-step flags consumed by FX: `justStepped` (+`stepX/stepY/stepAngle`, every 20 px), `justStartedRunning`, `justStopped` (+`stopDir*`, `stopSpeed`), `bloodStepsLeft`.
- `resolveSprite()` priority: hurt sheet → `expression` sheet → scared sheet → walk sheet. Walk frame 0 = idle, 1..frameCount-1 = walk cycle.
- `draw(ctx)`: invuln blink (alpha 0.4), fall spin/shrink, hurt jitter, bob + tilt, horizontal flip, sprite scaled to `sprite.drawHeight` (73).
- Bookkeeping fields set by `Game`: `_livesSeen`, `_fallSeen`, `bloodPalette` (PlayerFactory).
- `update(input, bounds, { canDash })`: `canDash` comes from `Game` (`dashUnlocked(!!mapData, demoProgress.state)` and not dragging the saw). See Dash below.

## Dash (individual, chain connected or snapped)

- Unlock (`dashUnlocked` in `js/systems/DashTether.js`): classic mode always; demo map only after the altar (`demoProgress.state.dash`). The player dragging the saw (`SawDrag.isDragging`) cannot dash. Until 2026-10-29 the dash also required the chain to be snapped.
- Chain connected (`DashTether`, Game-owned, applied right after both `Player.update`): a dashing player never ends farther than `PLAYER_DASH.connectedMaxDistance` (220, below `CHAIN.breakDistance` 240) from the partner. Excess distance is pulled back along the partner axis, so the dash slides along the radius; outward velocity is removed while braked and on the exit step of a dash that was braked. Both dashing apart split the pull. Dashing toward/sideways keeps the full distance. `Chain.update(..., { holdStrain })` freezes `strain` and skips the snap check while either player is dashing; after the dash normal strain/snap/spring rules apply. The saw yank is plain chain physics (no extra damage/FX).
- Key = `controls[4]` (P1 `" "`, P2 `"enter"`); gamepad A (0) / RB (5) mapped to it (`InputHandler.dashButtons`). Edge-triggered inside `Player` (`_dashHeld`), no buffer. A key already held when the dash becomes available does not fire.
- Starts only if `canDash && !feetInHole && dashCooldown === 0 && hurtTimer === 0` and not `falling`. `feetInHole` (`tiles.feetInHole(p)`, feet over a hole tile) blocks it; in practice those feet fall that same step.
- `Game.setPaused(false)` calls `latchDashKey()` on both players, so the Enter / pad A that closed the menu does not fire a dash. Game-over restart via Space/Enter/pad A/Start waits `GAME_OVER_INPUT_DELAY_MS` (400 ms, same as the death-button focus delay) because those are dash keys too. Direction = current 8-dir input, else `lastMoveX/Y`. No steering while `dashing`.
- `PLAYER_DASH` (GameConfig): `speed` 12 × `durationSteps` 12 (144 px = 2.25 tiles; was 9 steps / 108 px), then velocity = `exitSpeed` 4.2 along `dashDir*`. `cooldownSteps` 60, counted from the end of the dash (`dashCharge` 0..1 getter, 0 while dashing).
- While `dashing`: `takeDamage` returns false (separate from `invulnerableTimer`, no blink); `Game` leaves the player out of `resolveEntityCollisions` (walls still apply); `checkHoleFalls` skips the player (no pushback, no fall); no footsteps.
- End of dash: if the feet are on a hole tile, the player normally falls on the next step, BUT the dash now has a landing assist (2026-10-31). When a dash ends, `Player.holeGrace` is set to `HOLE_FALL.dashGraceSteps` (8) and counts down each non-dashing step. While `holeGrace > 0`, if the feet land on a hole tile, `DungeonTileQuery._dashLandAssist` looks for the nearest safe floor tile within `HOLE_FALL.dashLandAssistTiles` (1 tile; ≤1.5 tile centre distance) — preferring the dash direction, as if the player "won" the edge — and snaps the player onto it instead of falling. A 1-tile gap crosses with slack; a 2-tile gap landing short is now caught; the middle of a 3-tile gap (nearest floor 2 tiles away) still falls. Without `holeGrace` (ordinary walking) the feet fall as before. Demo maps with 2-tile gaps that are crossable: `demo_map.json` room `4,3` (1 H, 1 V), `inicial.json` room `1,1` (3 V).
- Flags: `justDashed` (Game plays `playerDash` + `triggerDust`), `justEndedDash`, `dashEnabled` (last `canDash`, read by the HUD bar). `afterimages` (tinted ghosts, drawn in `Player.draw`).
- Resets: `respawnAt` (death-respawn) and `restart` (new Player) refill the charge. `cancelDash()` (door transition, `newDungeon`) cuts a dash in progress but keeps the cooldown running. Reconnecting mid-dash lets the dash finish.
- `PlayerAI` never dashes (legacy bot).

**PlayerFactory** `{ assets, bloodCanvas }` → `create()` returns `[p1, p2]` at (0,0); Game positions them.

**Chain** (`new Chain(weapons, config)`; Game passes `[new SawWeapon(assets.saw, assets.cable)]`)
- State: `connected`, `strain` (step counter), `reconnectCooldown`. Getters `weapon`, `isConnected`, `name`.
- `update(p1, p2, { onSnap, onReconnect, resolveDropPoint })` — call once per step after players move.
- `forceDrop(p1, p2, resolveDropPoint)` — drop without snap impulse (used when a player falls in a hole).
- `reset()` — reconnect + `weapon.pickup()`.
- `drawChain` (cable), `draw` (saw), `drawDropped`, `getDroppedLight()` for LightingRenderer.
- `cycleWeapon()` and `applyToEnemies()` exist but are not called (hit detection lives in `CombatSystem.resolveWeaponHits`).

**SawWeapon**: `getSawPositions(p1, p2)` → `[{x, y, radius: 14}]` at `cablePoint(t=0.5)` (midpoint with drag bulge). Also `discRadius`, `collisionRadius`, `spinSpeed`, `spinDir`, `isHighSpeed`, `strain`, `dropped/dropX/dropY/dropT/dropHover`, `drop`, `pickup`, `updateDropped`, `setStrain`, `setOnBlood`, `playReconnect`, `onHit`.

## Data flow (per step)

1. `InputHandler.pollGamepads()` (frame start) rebuilds `input.keys` = keyboard keys ∪ gamepad-mapped keys.
2. `PlayerAI.update()` overwrites P1's movement keys when enabled.
3. `p.update(input, bounds)` → velocity, position (`Entity.update`), anim/step flags.
4. `Chain.update`:
   - Connected: `Physics.applyChainConstraint(p1, p2, rest, stiffness)` adds spring velocity beyond `rest`. `strain++` while `dist > strainDistance` (held while the Serra dupla is split), else `strain -= 2`.
   - Snap when `dist > breakDistance` OR `strain >= strainLimit`: players pushed apart by `snapImpulse`, `connected=false`, cooldown `reconnectDelay`, saw dropped at `resolveDropPoint(midpoint)` (`tiles.reachableDropPoint` → nearest reachable walkable tile), `onSnap` (shake 14, `sawSnap` audio, duck, sparks/flash).
   - Disconnected: reconnect when cooldown over and `_canReconnect`: if saw dropped, BOTH players within `pickupRadius` of drop point; otherwise `dist < reconnectDistance`. Then `weapon.pickup()`, `onReconnect`.
   - `weapon.setStrain(0..1)` (max of strain ratio and distance ratio), `weapon.update`, `weapon.updateDropped` when loose.
5. `Game.enforceSeparationLimit()`: hard positional cap at `MAX_PLAYER_SEPARATION` (620) while connected (larger than `breakDistance`, so normally unreachable).
6. Collisions: players + live enemies as ellipses (`resolveEntityCollisions`), saw disc as a solid circle (`collisionRadius`) when connected, wall boxes, room clamping.
7. Holes: `tiles.checkHoleFalls` → feet (`y + footOffset`) on a hole tile = `startFalling` that step, UNLESS the dash landing assist catches it (feet on a hole + `player.holeGrace > 0` → `_dashLandAssist` snaps to the nearest safe floor tile within `HOLE_FALL.dashLandAssistTiles`, prefers the dash direction). Resistance is outside the hole: within `HOLE_FALL.edgeMargin` (20 px) of a neighbouring hole tile, the inward velocity loses `1 - inwardDamping` per step and the player is pushed back up to `pushBack` px; parallel motion is untouched. A light push is held, insisting (~16 steps) or a full knockback (16) falls. First fall step: `_dropSawOnFall` → `chain.forceDrop` with `tiles.safeDropPoint` (seeded from non-falling players / entry spawns, avoids hole-adjacent tiles).
8. `_resolveFall` when `fallComplete`: `lives -= HOLE_FALL.livesLost`; if still alive, respawn NEAR the hole — `respawnAt(p.fallX, p.fallY, HOLE_FALL.respawnInvulnFrames)` (the hole tile centre) then `tiles.ensureSafeSpawn` spirals to the closest safe floor (2026-10-31; was the room entry spawn). If `lives <= 0` the fall leaves the pair for the death path (room-scoped respawn, see rooms-and-maps.md).
9. Hearts: `_updateHearts` gives +1 life (cap 3 hardcoded) if `dist <= heart.radius + player.hitRadius`.
10. Game over when either player hits 0 lives.

Kill rule (`CombatSystem.resolveWeaponHits`, only while connected): an enemy dies instantly (`startDying()`) if it touches the saw disc (`discRadius + enemy.hitRadius`) OR the whole p1–p2 segment (`weapon.hitThreshold + enemy.hitRadius`), except segment hits are ignored when the enemy is within `PLAYER_SAFE_ZONE` (46) of either player. The weapon never damages players.

## Spawn

`getPlayerSpawnPositions(dir, rect.x, rect.y, TILE)` (GameConfig) maps `PLAYER_DOOR_SPAWN_TILES[dir]` (`N/S/E/W/CENTER`, tile col/row inside the room) to world tile centers. `newDungeon()` uses `CENTER`; `transitionThroughDoor(door)` uses the opposite side of the exit door. Both zero velocity and call `_rememberEntrySpawns()` (respawn point after falls). Playtest (`?playtest=true`) overrides with `rooms.playtestSpawn` + `ensureSafeSpawn`. If the chain is broken on door transition it is `reset()` (saw returns).

## Input (`InputHandler`)

- Keys stored lowercase from `KeyboardEvent.key`. Arrow keys and Space get `preventDefault`. Window `blur` clears keys.
- P1: `w s a d` + dash `Space`. P2: `arrowup arrowdown arrowleft arrowright` + dash `Enter` (from `playerConfigs`, `controls[4]`). `Enter`/`Space` also restart on game over (`Game._bindButtons`).
- Gamepad index 0 → P1 keys, index 1 → P2 keys (`gamepadControls`). Left stick with `deadZone` 0.35, D-pad buttons 12/13/14/15, dash buttons 0/5. Converted into the same key names, so `Player` is device-agnostic.
- Menu pad handling is separate (`MenuPad` in `Game._pollMenuPad`, any pad: 9 Start, 0 A, 1 B, D-pad/stick ±0.6; see `ui.md`).

## PlayerAI (debug)

Disabled by default; toggled with `I` (own keydown listener) or `window.playerAI.enable()`. Drives P1 only by injecting keys into `input.keys` (clears P1 movement keys first, so it overrides human/gamepad input). Priority: `_combatDir` (aim at a point 60 px behind nearest visible enemy relative to P2, orbit when < 24 px; orbit dir flips every 90 steps) → `_doorDir` (only if P2 is within 170 px of an open door) → `_followDir` (stay within 70 px of P2). `_avoidHoles` probes 26 px ahead and tries ±25..±160° deflections. Doors supplied only when room unlocked.

## Config knobs

- `js/config/ChainConfig.js` `CHAIN` (was hard-coded in the `Game` constructor until `feat/anvil-forge`): `rest 130`, `stiffness 0.02`, `breakDistance 240`, `strainDistance 165`, `strainLimit 30`, `reconnectDistance 110`, `pickupRadius 60`, `snapImpulse 12`, `playerSafeZone: PLAYER_SAFE_ZONE`. `reconnectDelay` default 20 (Chain.js). The Elasticidade upgrade rewrites `chain.strainDistance`/`breakDistance` from these bases (`applySawUpgrades`).
- Saw absent (Editor 2.0 maps whose anvil offers the Serra recipe): `chain.reset({ present: false })` → `hasSaw` false, not connected, `_canReconnect` and `forceDrop` refuse, nothing is drawn. `reset()` without arguments keeps the current `present` (door transition). `chain.spawnSaw(x, y)` makes it present and dropped at a point; both players must then come within `pickupRadius`. While absent, players walk free and dash only if `demoProgress.state.dash`.
- `js/config/GameConfig.js`: `PLAYER_DASH`, `MAX_PLAYER_SEPARATION`, `PLAYER_SAFE_ZONE`, `PLAYER_DOOR_SPAWN_TILES`, `getPlayerSpawnPositions`, `HOLE_FALL` (`edgeMargin`, `footOffset`, `inwardDamping`, `pushBack`, `livesLost`, `respawnInvulnFrames`), `HEART_DROP` (`maxLives` 3, not read by `_updateHearts`), `HIT_SLOWMO`.
- `js/config/EntityConfig.js`: `playerConfigs` (color, controls, name, sprite crops, `drawHeight`, hurt/scared sheets).
- `Player.js` (hardcoded): `speed`, `lives`, invuln 65, knockback 16, `hurtDuration`, `scaredDuration`, `fallDuration`, `slideDuration`.

## Invariants & gotchas

- Units are pixels per simulation step (60 Hz), not per second. Changing `SIM_HZ` changes game speed.
- Player order matters: `[p1, p2]` from `playerConfigs`; HUD, input mapping and AI assume index 0 = P1.
- Keys must be lowercase `KeyboardEvent.key` values.
- `restart()` recreates Player objects; anything caching player references must use getters (`getP1: () => this.p1`), as PlayerAI and VtuberHud do.
- Lives cap is hardcoded `3` in `Game._updateHearts` and `Player` constructor.
- `Player.expression` is never set anywhere and `playerConfigs` has no `expressions`; the expression branch of `resolveSprite` is dead (expressions are used by VtuberHud portraits instead).
- `Player.update` sets `facingLeft` with 0.15 threshold after `Entity.update` already did with 0.1.
- `R` restarts instantly during play (no confirmation).

## How to extend

- New player tuning: move constants into `GameConfig`/`EntityConfig` rather than adding more literals.
- New weapon: implement the `SawWeapon` surface (`getSawPositions`, `update`, `draw`, `drawChain`, optional `drop/pickup/updateDropped/drawDropped/setStrain`), add it to the `Chain` weapons array in `Game`, and wire a key to `chain.cycleWeapon()`.
- New input device/binding: map it into existing key names in `InputHandler.pollGamepads` so `Player` stays unchanged.
- Chain events: add callbacks to the `events` object of `Chain.update` and handle FX/audio in `Game`, not inside Chain.

## Related docs

- `../architecture.md` — loop/update order.
- `rendering.md` — shadows, depth sort around saw Y.

### Enemy knockback option (2026-10-28)
Player.takeDamage(sourceX, sourceY, { knockback = 16 } = {}) accepts an optional radial velocity impulse magnitude. Only accepted damage applies it; player Dash, invulnerability and falling still reject damage and push. Golem normal/AoE/dash use configured amounts; dash synthesizes a source behind the player to push forward. Existing player movement damping and hole grace/fall detection determine the displacement and possible fall. Player Dash config is unchanged.

## Chain obstruction (2026-10-29)
Game owns `chainObstacles` (`ChainObstacleSystem`), applying grounded immovable boss resistance to saw/cable and transmitting positional correction and friction to both players. A final solve includes room walls/clamps; infeasible pinching safely releases the saw via `_dropSawSafely` (also used for falls). Tuning in `ChainCollisionConfig.js`; no wrapping simulation. See weapons.md for contact damage and thrown-saw behavior.

### Softer tether contact (2026-10-29)
Golem cable resistance now permits8px compression with a2px shared soft correction budget per step, 3% friction and25% inward velocity reduction once per contact. Hard correction still enforces the compression boundary. Allowed compression does not trigger safe drop; infeasible wall pinches still do. Motor sustain belongs to SawWeapon (weapons.md), not physical collision.


## Feedback de tensão (2026-10-31)
Game owns ChainTensionFeedback, updated once before rendering all views. It reads current rest/strain/break limits and accumulated strain without changing Chain physics. Anticipation starts between rest and strainDistance; effort and real rupture risk share smoothed presentation state. Dash keeps physical effort but clears critical warnings immediately; an open double saw excludes paused temporal strain while keeping distance risk. Inactive game states clear faces/motion and silence the loop. newDungeon resets/disposes the voice. Player.tensionExpression is separate from explicit/cinematic Player.expression; damage/scared sprites retain priority.

### Estalo do cabo refeito (2026-10-31, `.agents/tasks/2026-10-31-cable-snap-feel/`)
Descartados o brilho vermelho no cabo (`_drawGlow`), os anéis/pixels que pulsavam nas âncoras (`_drawEffortPulse`) e a **cara de raiva/fúria** (`tensionExpression`): a escolha do usuário é não ter esse feedback vermelho sobre o canvas nem reação no rosto. O aviso de "vai estourar" passou a morar na própria arte da corda. Agora:
- **Afinamento (anticipation):** `SawWeapon._cableThickness()` lê `tensionFeedback.risk` e, acima de `cableThin.startRisk`, estrangula a altura desenhada do cabo (`drawH = linkH * thin`, piso `cableThin.minThickness`) no caminho do sprite e no stroke de fallback. O passo da textura (`tileW`) **não** muda, só a espessura; a física do Chain é intocada.
- **Piscar (textura):** `SawWeapon._cableAlpha()` oscila a opacidade (`ctx.globalAlpha`) da textura inteira da corda entre 1 e `1 - depth`; a frequência (`cableBlink.hzMin→hzMax`) e a profundidade (`depthMin→depthMax`) crescem com o risco, acima de `cableBlink.startRisk`. A fase (`SawWeapon.blinkPhase`) é acumulada em `SawWeapon.update` (um passo = 1/60 s). Perto da ruptura a textura pisca rápido e fundo. Esse é o único aviso visual de tensão.
- **Disco sem tremor/glow por tensão (revisão 2):** o tremor e o halo azul do disco por strain em `SawWeapon.draw` saíram (`strainShake` e o `flash` por tensão removidos; o disco só treme pelo giro/transição e só pisca branco na reconexão, `_reconnectFlash`). `SawWeapon.flashPhase` foi removido.
- **Tremidinha (revisão 3/4):** a partir de `preSnapShake.start` (cedo, assim que entra em tensão — hoje 0.18) `visualCablePoint` dá um chacoalho transversal na corda, ruído por segmento (duas senóides defasadas por `t`). A amplitude vai de `ampMin` (tremidinha sutil) a `ampMax` e a frequência de `hzMin` a `hzMax`, ambas por uma curva `power` do risco (entrada suave) — cresce até a ruptura. Envelope `sin(t·π)` prende as âncoras nos jogadores (t=0/t=1 exatos). Abaixo de `start` a corda segue a reta física. Junto com afinar + piscar, é o aviso de "vai estourar".
- **Estalo = corte seco (revisão 5):** `ChainTensionFeedback.onSnap(point)` guarda o ponto de ruptura (passado pelo `Game.onSnap`). Durante `snapSeconds` (curto, 0.14), `_drawSnap` faz as duas metades do cabo recuarem **retas e rápido** (ease-out forte, ponta `butt`, sem overshoot/kink/fade) e sumirem de vez dentro de `snap.cutWindow` (fração de `snapSeconds`); depois disso nada é desenhado — corte abrupto, sem rastro nem chicote. Nada de glow/clarão/círculo. O impacto vem do hit-stop (subiu pra `hitStopSeconds` 0.09, perto do teto 0.10), do `triggerShake(14)`, das faíscas (`snap.sparks` 14) e do `sawSnap`. Removidos `snap.recoil/overshoot/kink` e `snapSide`.
- **Camada de impacto:** `Game.onSnap` tem hit-stop curto (`gameLoop.triggerHitStop(CHAIN_TENSION.hitStopSeconds)`) + o tremor **de tela** (`triggerShake(14)`) / duck / faíscas (`snap.sparks`) / `_snapWave`. O `triggerFlash` branco foi **removido**. (O `_snapWave` só desenha um anel se a melhoria Estalo foi comprada — `snapWaveRadius > 0`; numa run normal não aparece.)
- Config em `js/config/ChainTensionConfig.js`: `hitStopSeconds`, `cableThin`, `cableBlink`, `preSnapShake`, `snap` (agora com `color`, sem `flash`/`flashRadius`); `snapSeconds` 0.24→0.30. `motion` ficou só com `reduced`. Removidos: `glow`, `expressions`, `criticalEnter/Exit`, `tensionGlowTargets`, `_drawGlow`, `_drawEffortPulse`, o avanço de `s.phase`, e a onda "curvadinha" do `visualCablePoint`.
- Consequência: o `VtuberHud` nunca mais recebe `tensionExpression` (sempre `null`), então o retrato não faz mais a cara de tensão. O caminho de `Player.resolveSprite`/`expression` explícito segue intacto.
- Testes em `tests/test_chain_tension.js` (afinamento com piso; `onSnap` guarda ponto e alterna lado; a tensão nunca mais seta expressão). Não foi observado no jogo rodando (sem browser/headless aqui) — verificado por `npm test`, `node --check js/Game.js` e `npm run validate:map`.

## Segunda chance (2026-10-31, `feat/penhasco-forge`)
Receita `lastStand` (60 moedas) na bigorna da botas, último item de `FORGE.bootsRecipes`. `js/systems/LastStand.js`: uma carga por jogador por sala. `Game._resolveFall` chama `lastStand.save(p)` logo depois de `loseLife` (a queda salva segue o caminho normal de renascer perto do buraco); `_step` chama `lastStand.check([p1, p2])` antes do feedback de dano e da regra de morte (golpes). Salvo = `lives = 1` e `invulnerableTimer` ≥ 90 steps, mais clarão, tremor e o som `pickup` (`FORGE.lastStand`). Não gasta com vida infinita. As cargas voltam com `reset()` em nova run, morte na sala, TP e porta. Como a regra de morte olha os dois jogadores, a carga de cada um só protege o próprio jogador.
