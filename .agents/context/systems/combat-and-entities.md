# Combat, enemies, traps & pickups

## Purpose
How enemies are defined, spawned, navigate, attack and die; how players take damage and heal; how traps/pressure buttons are authored and run. Weapons (the saw) are in `weapons.md`.

## Files
- `js/entities/Entity.js` — `Entity` base (players + enemies only).
- `js/entities/MeleeEnemy.js` — default melee behavior. `GhostfireBoss.js` specializes the trailer boss.
- `js/config/GhostfireConfig.js`, `js/systems/GhostfireSystem.js`, `js/systems/GhostfireRenderer.js` — boss timings/stats, minion/FX orchestration, sprite and beam rendering.
- `js/entities/Player.js` — `takeDamage`, `lives`, `invulnerableTimer` (damage interface only).
- `js/combat/CombatSystem.js` — `CombatSystem`: enemy updates, saw hits, deaths/gibs, heart drops, combat SFX.
- `js/systems/SpawnSystem.js` — `SpawnSystem.createEnemy(x, y, floor, type)`.
- `js/config/EntityConfig.js` — `demonConfig`, `bloodMonsterConfig`, `MELEE_ENEMY_CONFIGS`, `ENEMY_TYPES`, `ENEMY_TYPE_BY_KEY`, `playerConfigs`.
- `js/config/TinyRpgEnemies.js` — `TINY_RPG_ENEMIES` (17 data-only enemy sprite definitions).
- `js/rooms/SafeSpawn.js` — `isSafeFloorCell`, `findSafeFloorCell`.
- `js/rooms/Room.js` — `populate`, `spawnEnemies`, `removeEnemyAt`, `addHeart`, `hearts`, `lockRule`.
- `js/systems/ChallengeCorridor.js` — builds/updates/draws traps + buttons from `cell.customHazards`.
- `js/entities/SpikeTrap.js`, `ArrowTrap.js` (`ArrowTrap` + `Arrow`), `PressureButton.js`, `HeartPickup.js`.
- `js/config/GameConfig.js` — `HAZARDS`, `HEART_DROP`, `PLAYER_SAFE_ZONE`, `MAX_ACTIVE_GIBS`, `BLOOD_STAIN_CONFIG`, `HOLE_FALL`, `ROOM_INTRO`.
- `js/core/AssetLoader.js` — image keys (`demon`, `bloodMonster`, each `TINY_RPG_ENEMIES[].key`, `peaks0-3`, `arrowTrap1-4`, `arrow`, `button`, `heartPickup`).
- Wiring: `js/Game.js` (`_updateGameplay`, `_updateRoomIntro`, `_updateHearts`, `_buttonFeedback`, `_arrowTrapFeedback`, `_render`).

## Key types & APIs
**`Entity(x, y, hitRadius=16)`** fields: `x, y, vx, vy, hitRadius, markedForDeletion` (unused), `facingLeft, animTimer`; getter `speedMag`; `update()` integrates velocity and sets `facingLeft`; `draw(ctx)` no-op. Traps/hearts/buttons do **not** extend `Entity`; they are plain classes with `x, y` and their own `update/draw`.

**`MeleeEnemy(x, y, sheet, spriteConfig, floor=1)`** (hitRadius 18)
- Tuning (hard-coded in constructor): `speed 1.7`, `attackRange 44`, `hitRange 58`, `windupFrames = max(16, 55 - (floor-1)*6)`, `recoverFrames 28`, `dyingDuration 9`.
- States (`state`): `"chase" → "windup" → "attack" → "recover" → "chase"`; `"hurt"` / `"stunned"` after a surviving saw hit (back to `"chase"` when `stateTimer` ends); `"dying"` when hp reaches 0. `"dead"` branch exists (`isDead`, `deathDone`, `corpseTimer`) but nothing sets it — dead code.
- Spawn: `beginFrozenSpawn(delay)`, `unfreeze()`, `isHidden` (spawnDelay>0), `spawnFx`, `justAppeared`.
- Navigation: `setNavigationFloor(floor, bounds, walls)`, `_isWalkable`, `_chaseWaypoint` (4-dir BFS over the floor grid, returns the next tile center), `_hasClearWalkablePath` (sampled line check, used before windup and before dealing damage), `ensureOnWalkableTile()` (snap back to `lastSafePosition`).
- Death: `startDying()`, `isDying`, `readyToGib` (dying && `dyingTimer<=0`), `explodeIntoGibs()` → `GibPiece[]` cut from the last `death` frame.
- Hit reaction (`takeHit(damage = 1, hit = null)`, numbers in `ENEMY_HIT`, `js/config/CombatFeelConfig.js`). Returns `false` when refused (`hitTimer` cooldown 24 steps, `frozen`, `dying`); otherwise `{ damage, killed, staggered, poiseBroken, vulnerable }`. Without `hit` (`{ dirX, dirY }`, source → enemy) it only subtracts hp (legacy callers: trailers, `ThrownSaw`). With `hit`, a surviving enemy interrupts windup/attack/recover (`dealtHit`/`justAttacked` cleared), freezes its current frame (`_hurtPose`), enters `"hurt"` (14 steps), gets a knockback impulse (`pushVx/Vy`, stopped by `_isWalkable`) and a white→red flash (`flashTimer`, tinted in `draw`). Strong enemies (`combat.poise > 0`, e.g. `tank`) lose `perHit` poise per accepted hit; at 0 the poise resets, the enemy is `"stunned"` for 60 steps with a stronger push and `vulnerableTimer` (72 steps) where damage × `vulnerableDamageMult` (2) and the sprite pulses yellow. Poise refills after `regenDelaySteps` without hits. A lethal hit goes straight to `"dying"` (no knockback).
- Per-frame flags read by `CombatSystem`: `justStepped` (every 48px while chasing), `justAttacked`.
- `draw(ctx)`: sprite-sheet crop; blinks `deathFlash` frame while dying; bottom-up reveal clip during `spawnFx`.

**`CombatSystem({ renderer, particleSystem, audio, hitFeedback = false })`** (`Game` passes `hitFeedback: true`; trailers keep the old behaviour)
- `updateEnemies(enemies, players)` — calls `e.update(players, onPlayerHit)`; on hit: shake 14, `playerHurt` SFX, blood. Plays `enemyStep`, `enemyAttack`, `enemyAttackVoice` from flags.
- `resolveWeaponHits(weapon, enemies, p1, p2, connected, onKill, onHit)` — see weapons.md. Per accepted hit (once; `takeHit` refuses during the enemy cooldown, so contact frames do not repeat anything): impact point (disc ⇒ point on the disc rim toward the enemy; cable ⇒ closest point on the p1→p2 segment, `Physics.closestPointOnSegment`), `takeHit(ENEMY_HIT.sawDamage, impact)`, `weapon.onHit()`, then `_hitFeedback`: shake by tier (`HIT_FEEL.shake`), directional sparks + glint at the impact, directional blood + dust (or the old `triggerBlood` on a kill), floating damage number with the real damage. `onHit(enemy, info)` runs for every accepted hit (`info = { damage, killed, poiseBroken, staggered, tier: hit|kill|poiseBreak, hitStop, x, y, dirX, dirY }`; `Game` uses it for `enemy.freezeOnHit(info.hitStop)` (freezes only that enemy) + `sawMotor.onHit()`); `onKill(enemy)` only when the hit kills (`Game` ⇒ hit slow-mo). Then `_playSawHit(hits, heavy)` once (combo pitch step 0.035, window 900 ms, + audio duck; a poise break plays it lower/louder and ducks −9 dB). `monsterHurt` is still called but is disabled/empty, so it is not feedback.
- `resolveDeaths(room, gibs, onKill, players)` — for each `readyToGib`: blood + pool, push gibs (cap `MAX_ACTIVE_GIBS`=90, FIFO), maybe drop heart, `room.removeEnemyAt(i)`.
- `canDropHeart(room, players)` — true only if total missing lives (vs `HEART_DROP.maxLives`) > hearts already in room.

**Player damage interface** (`Player.takeDamage(srcX, srcY)`): returns `false` if `falling` or `invulnerableTimer>0`; else `lives--`, `invulnerableTimer=65`, hurt/scared timers, knockback impulse 16 away from source; returns `true`. `lives` starts 3. Holes subtract lives directly in `Game._resolveFall` (`HOLE_FALL.livesLost`, respawn invuln 90).

## Data flow

### Ghostfire (boss from the opening trailer)

`type: "ghostfire"` in authored enemies creates `GhostfireBoss` through `SpawnSystem`. In the editor it is listed as **Ghostfire (Boss do trailer)**. The existing `assets/enemies/ghostfire.png` is shared with `BossWallShot`; no generated assets or new runtime dependencies are needed.

The boss starts on the right side, finds a non-negative floor cell without an authored wall, and runs `appear → roar → summon → wait → charge → indicator → beam → fade → recover → teleport`. Teleport switches sides and repeats the arrival. During charge it tracks the live players' mean Y along walkable floor; the horizontal beam locks before the warning and stays fixed through firing/fade. Beam origin is the sprite's mouth, endpoint is the opposite arena edge, and damage is active only during `beam` (players use `takeDamage`; enemies intersecting the beam die).

Gameplay beam pacing uses 108 wait ticks (1.8s), 30 charge ticks (0.5s), 33 locked-warning ticks (0.55s), and 54 recovery ticks (0.9s). Charge plus warning gives 1.05s before firing. The active beam lasts 30 ticks (0.5s). These timings are tuned in `GhostfireConfig.js`.

Summons release one at a time during the spit pose (ticks 18, 23, 28, 33, 38), cycling `hellbat`, `demonessA`, `demonessB`. Preferred positions are in front of the boss; forward safe grid cells and then the rest of the room are fallbacks. Holes, negative floor, walls, proximity to players/enemies and the six-minion cap are respected. Room size and obstacles can reduce the wave.

`CombatSystem.resolveWeaponHits` uses `takeHit()` and emits hit feedback only for accepted hits. Ghostfire forwards `takeHit()` to its `receiveWeaponHit()` rules, preserving eight health, a 45-tick hit cooldown, and immunity while frozen, arriving or teleporting for both connected and thrown saws. Local hit stop pauses its state timer. The death animation lasts 48 ticks before gibs; `GhostfireSystem` plays a single final burst and kills remaining non-boss minions, as in the trailer. Ghostfire-specific effects and lights use `isGhostfire` so the separate FireSkull boss keeps its own behavior.

`Game` calls `ghostfire.update` after enemy updates, warning drawing on the floor, the firing/fading beam in the air, and `renderLights` before post-processing. Generic melee attack audio is suppressed for bosses; `ghostfireRoar`, `ghostfireSummon`, `ghostfireCharge`, `ghostfireBeam`, `ghostfireDeath` reuse the trailer clips through `AudioConfig`.
1. **Authoring**: room pieces (`map/*.json`, made in `editor.html`) carry `enemies: [{type, col, row}]` and `hazards: [...]`. `RoomManager` copies them to `cell.customEnemies` / `cell.customHazards`.
2. **Enter room**: `RoomManager.enter()` → `Room.populate(spawnSystem, floor, assets)`: builds `ChallengeCorridor` if hazards exist, seeds `cell.heartCount` hearts, sets `cleared` from `lockRule` (`"buttons"` needs ≥2 buttons; `"enemies"`; `"none"`).
3. **Spawn**: `Game._activateRoomEnemies` → with `ROOM_INTRO.enabled`, `_updateRoomIntro` calls `room.spawnEnemies(true)` then `_scheduleStaggeredSpawns` (shuffled `beginFrozenSpawn(acc)`, +8..23 frames each); `enemySpawn` SFX + flame burst on `justAppeared`; all `unfreeze()` at end of zoom-out. `spawnEnemies`: per authored foe → `findSafeFloorCell(floor, col, row)` (skip if none) → world `minX + (col-0.5)*TILE` → `spawnSystem.createEnemy(...)` → `setNavigationFloor(...)`.
4. **Frame** (`Game._updateGameplay`): players → chain/weapon → `room.challenge.update(players, dt)` → `combat.updateEnemies` → entity/saw/wall collisions (`Physics`) → `ensureOnWalkableTile` → `rooms.clampEnemy` → hole falls → `combat.resolveWeaponHits` (onKill: hit slowmo + `sawMotor.onHit`) → `combat.resolveDeaths` (onKill: `screenGore.trigger`) → `_updateHearts` → gibs → lives-diff check plays `playerHit` + gore flash for any life loss → `rooms.tryClearCurrent()` → game over if either player `lives<=0`.
5. **Render** (`Game._render`): `challenge.drawFloorLayer` (spikes) → floor particles → `challenge.drawButtons` → heart **shadows** → entity shadows → chain → y-sorted players/enemies/button occluders split around the saw y → `challenge.drawWallLayer` (arrow traps) → front wall → gibs → `challenge.drawAirLayer` (arrows) → post-processing → heart **sprites** via `drawOverlay` inside `renderer.beginOverlayWorld()` (after lighting, above everything).

## Traps & pressure buttons
Hazard element schema (`cell.customHazards[]`, editor `_addHazardAt`): `{ type, col, row, ... }` in full-room tile coords (0 = border wall). `ChallengeCorridor._build` maps by type (`_tileToWorld`; legacy `u/v` fractions still supported via `_toWorld`):
- `spike` — `{timing, delay, phase?, durations?}` → one `SpikeTrap`.
- `spikeRow` — `{count, dir: left|right|up|down, wave, phase, timing, delay}` → `count` spikes; per-spike phase offset = `i*wave` (sign by `dir`) for a travelling wave.
- `arrow` — `{side: top|bottom|left|right, phase}`; fire dir from `_fireDirFromWall(side)`, inverted x for interior lateral walls.
- `button` — `PressureButton`. Room solves when ≥2 buttons all pressed for `HAZARDS.challenge.holdFrames` (10).

`SpikeTrap(x, y, peaks, {timing, durations, delay, phaseOffset})`: 4-phase cycle in **seconds** `[hidden, warn1, warn2, exposed]`; profiles `fast [0.5,.1,.1,.8]`, `normal [1,.15,.15,2]`, `slow [2,.3,.3,3]`; `durations` (len 4) overrides. `delay` = seconds before the first cycle starts. Damages while `frameIndex===2` within `HAZARDS.spike.damageRadius + p.hitRadius*0.4`. Frames: `assets/peaks/peaks_0..3.png` (3 = hidden). `HAZARDS.spike.hiddenFrames/warnFrames/...` are **unused** legacy.
`ArrowTrap(x, y, dir, {phaseOffset, sprites, arrowSprite})`: period `HAZARDS.arrowTrap.intervalFrames/60` s, warn window `warnFrames/60`; fires one `Arrow` per cycle via `onFire`; `justFired` drives `arrowFire` SFX (distance-attenuated in `Game._arrowTrapFeedback`). `Arrow` moves `HAZARDS.arrow.speed`·60 px/s, dies after `maxLifeFrames/60` s, out of bounds, or on first player contact (calls `takeDamage`).
`PressureButton`: pressed if any live, non-falling player's feet within `cfg.pressRadius` (y-squashed); `_assist` gently pulls nearby players onto the cap; `justPressed/justReleased` → `buttonPress` SFX in `Game._buttonFeedback`; `buttonOccluders`/`drawOcclusion` re-draw the button over entities standing behind it.

## Heart pickups
- Sources: `cell.heartCount` (scattered ±90/±60 px around room center in `Room.populate`) and enemy gibs in `CombatSystem.resolveDeaths`: if `canDropHeart`, chance = `room.cell.heartDropChance` (0..100) else `HEART_DROP.chance` = **15** %. `heartCount`/`heartDropChance` are only set by `DungeonGraph` layouts (validated 0..10 / 0..100); editor room pieces don't author them, so 15 % is the effective default.
- `Game._updateHearts`: player with `lives < 3` within `heart.radius(24) + hitRadius` heals +1 (cap 3, hard-coded, not `HEART_DROP.maxLives`), `pickup` SFX (pitch climbs on streaks within 2.5 s), flash.
- `HeartPickup.sheet` is static, set in `Game` constructor from `assets.get("heartPickup")`; 12×12 art drawn at 4×.

## Scrap and chests (Editor 2.0 maps only)
`Game` builds `scrap`, `chests` and `scrapCounter` only when `mapData` exists; the classic procedural mode has no scrap.
- `SpawnSystem.createEnemy` sets `enemy.typeKey` (the authored type, `null` for random melee). `CombatSystem.resolveDeaths` → `onKill(enemy)` → `scrap.dropFromEnemy(enemy)`: `SCRAP.drops` = demon 1, bloodMonster 3, blackKnightB 5; other types drop nothing.
- `ScrapPickup` (plain class, not `Entity`): `x, y` on the floor plus height `z`. It flies in an arc (gravity, bounces until `|vz|` < `minBounceVz`), lands, rests `restSteps` (24 = 0,4 s), then accelerates toward the nearest live, non-falling player within `magnetRadius` (2,5 tiles). Collected within `collectRadius + player.hitRadius`. `vacuum = true` skips the rest and the radius.
- `ScrapSystem`: one shared `ScrapWallet` (`amount`, `add`, `canAfford`, `spend`, `reset`), `spawnBurst(x, y, n, { dir, spread, profile })`, `dropFromEnemy`, `vacuum()`, `update(players, bounds)` (plays `scrapPickup`, pitch climbs on quick streaks), `collectAll()` (called by `transitionThroughDoor`: leftover floor scrap is credited, not lost), `clear()`, `reset()` (in `newDungeon`). One pickup = 1 scrap.
- `ChestSystem`: every prop whose def has `opens` (`chest` → `chest_open`, `mini_chest` → `mini_chest_open`) stays on its first frame while closed, with a diagonal shine sweeping across the art (`PropSprites.drawFrame(..., shine)`, the same idea as the dropped saw's beam; speed `CHEST.shineSpeed`). It opens once per run when a live player within `CHEST.openRadius` (1 tile from the footprint center, straight distance; walls are not checked) presses their own interact key (P1 `e`, P2 `shiftright`, pad X maps to them). While someone is that close the prompt bar shows `chest.prompt`. A key already held does not count; opening calls `onOpen`, which `Game` uses to latch the interact state of the forge, dialogue and `DemoProgress` (one press = one action). One chest per press. It plays `chestOpen`, squashes the lid, and after `burstDelaySteps` bursts `chestScrapAmount(prop)` scrap toward the front (south). Amount = `prop.scrap` from the Editor 2.0 (integer 0..999) or `SCRAP.chestDefault` (10). State is keyed `room.key/col,row`, survives leaving the room, and is cleared by `newDungeon` (restart; the design wants opened chests to stay open after a death, which belongs to the death rule of slice 4). `flushPending()` credits the scrap of chests that opened but did not burst yet (door exit). `justOpened` lists the chests opened this step (hook for the room scripts of slice 4/5). `frameFor(prop, roomKey)` feeds `RoomProps` the opening frame.
- Solid props (`PropConfig` `base`): see `rendering.md` → Depth sorting. Their base box blocks feet of players and enemies (`RoomProps.resolveCollisions`); enemy navigation does not know about them.

## Config knobs
`HAZARDS.{spike.damageRadius,drawSize; arrowTrap.*; arrow.*; button.*; challenge.holdFrames}`, `HEART_DROP.{chance,maxLives}`, `PLAYER_SAFE_ZONE` (46), `MAX_ACTIVE_GIBS`, `BLOOD_STAIN_CONFIG.gib`, `ROOM_INTRO`, audio cues in `js/config/AudioConfig.js` (`AUDIO_CONFIG.cues`). `js/config/CombatFeelConfig.js`: `ENEMY_HIT` (damage, cooldown, stagger, poise, flash, jitter), `HIT_FEEL` (shake, hit stop per tier, sparks, blood, dust, glint), `DAMAGE_NUMBER`; `GameConfig.HIT_STOP` (min/max/gap). Per-enemy `hp`/`poise`/`speed` come from `combat` in `DemoCombatConfig.js`; other enemy stats are constructor constants in `MeleeEnemy`.

## Invariants & gotchas
- Enemy spawn tiles: `isSafeFloorCell` rejects `HOLE_TILE` (-1), any negative (incl. `EMPTY_FLOOR_TILE` -2) and the border ring. It does **not** check `cell.customWalls`, so an authored foe can spawn inside a wall block (box collision then pushes it).
- `MeleeEnemy.setNavigationFloor` ignores its `walls` arg; `navigationWalls` stays empty, so BFS paths through wall blocks. Navigation treats only `-1` as blocked (not `-2`).
- Without `navigationFloor` every walkable check returns `true` (straight chase).
- `resolveWeaponHits` skips only `"dying"`; it does not skip hidden/frozen enemies (safe today because the intro replaces `_updateGameplay`).
- Enemy hit plays both `playerHurt` (CombatSystem) and `playerHit` (Game lives-diff) — same wav set, double layer.
- Traps don't hurt enemies; arrows/spikes only call `takeDamage` on players.
- Spikes/arrows use real seconds (`deltaSeconds`); enemies, buttons, hearts and the saw are per-step (60 Hz fixed sim).
- `ENEMY_TYPES` keys must match `AssetLoader` image keys (`tinyRpgConfig` uses `assets.get(key)`).
- `explodeIntoGibs` requires `rows.death`.
- Sprite `fps` is misnamed: it is **sim ticks per animation frame** (`frame = animTime / fps`), so larger = slower.

## Enemy sprite schema (`TINY_RPG_ENEMIES[]` / `*Config(assets)`)
`{ key, label (pt-BR, shown in editor), src, cellSize (px per grid cell, 100), cropX, cropY, cropW, cropH (visible box inside a cell), body? {x,y,w,h} (feet/anchor box; drawHeight then scales the body), drawHeight, rows: { walk, attack, attack2?, attack3?, death } each {row, frames, fps, hitFrame? (attack: frame that deals damage, default frames/2)}, deathFlash? {row, frame} (blink frame while dying), gib {gridCols, gridRows, box?} }`. Sheets: `assets/enemies/*.png`, one animation per row. `attack*` keys present are chosen at random per attack.

## How to extend
See `.agents/playbooks/add-enemy.md` and `.agents/playbooks/add-trap.md`.

## Tests
- `node tests/test_ghostfire.js` — phased attack cycle, staggered releases, locked horizontal aim, player/minion damage, side switch, weapon health/cooldown/death, safe capped summons, final minion cleanup.
- `node tests/test_safe_spawn.js` — `findSafeFloorCell` rules.
- `node tests/test_player_spawns.js`, `node tests/test_hole_resistance.js` — related spawn/hole behavior.
- `node tests/test_combat_feel.js` — `MeleeEnemy` stagger/poise/knockback, `CombatSystem` impact point/dedupe/events (fake renderer, particles, audio), `GameLoop` hit stop vs pause/slow-mo, damage numbers.
- No tests for traps; verify in game: `python serve.py` → http://localhost:8000 (or `npm start` for Electron).

## Related docs
`weapons.md`, `.agents/playbooks/add-enemy.md`, `.agents/playbooks/add-trap.md`, `.agents/playbooks/add-weapon.md`.

## Black Knight B — tanque
`blackKnightB` (`assets/enemies/black_knight_b.png`) tem `combat.hp = 4`, velocidade 0.8, preparação de 65 ticks e recuperação de 45 ticks. Usa as três linhas de ataque em ciclo (`attack` → `attack2` → `attack3`), com dano nos `hitFrame` de cada linha. O cooldown compartilhado de acertos (24 ticks) impede perder toda a vida em um único contato contínuo.

Opções de sprite `combat.cycleAttacks` e `combat.playDeathAnimation` são opt-in. A segunda mantém o estado `dying` sem ataques/movimento durante `death.frames * death.fps` ticks, desenha a linha de morte sem o flash e só então permite os gibs/remoção. Para o cavaleiro são 4 quadros × 7 ticks = 28 ticks. Outros mobs preservam a seleção aleatória de ataques e morte anterior.

Verificação: `node tests/test_black_knight_b.js` cobre SpawnSystem, dano via CombatSystem, cooldown, ciclo com dano dos três ataques e os recortes reais enviados ao canvas durante a morte.

## Cultista — pilar de fogo
`cultist` usa `CultistEnemy extends MeleeEnemy`, criado pelo SpawnSystem e disponível nos dois editores. Configuração em `js/config/CultistConfig.js`; `preferredDistance` é um atributo público da instância, inicializado em 300 px, com tolerância de 24 px. Em chase, aproxima-se até essa faixa ou escolhe entre oito direções de recuo a que melhora a distância ao jogador vivo mais próximo, sem atravessar tiles bloqueados. Em situações sem rota segura ele pode ficar encurralado. Conjuração e recuperação são estacionárias.

Ao entrar em windup, copia a posição do jogador vivo/não caindo mais próximo. A posição gravada não acompanha o alvo e não tem marcador circular no chão. Após 45 ticks de preparação, usa apenas a quarta linha da PNG (row 3, 14 quadros × 6 ticks). O recorte do pilar é desenhado separadamente na posição marcada por `drawAttackEffect`, chamado no passe de chão do Game; quadros 8–11 causam dano num raio de 30 px (+ hitRadius do jogador), uma vez por jogador por conjuração. Sair da área evita o ataque, entrar durante os quadros ativos permite receber dano. Não causa dano corpo a corpo. Stagger e morte cancelam a marca/pilar; hit stop e pausa congelam seus timers.

Morte: última linha (row 5, 10 quadros × 7 ticks), completa antes da remoção; sem gibs por terminar em dissipação. Reutiliza spawn congelado, feedback de acerto, navegação e ciclo de morte do MeleeEnemy. `tests/test_cultist.js` verifica distância configurável, alvo fixo, esquiva, AoE, interrupção, spawn e morte.

A distância máxima de conjuração é 464 px, cobrindo a faixa desejada de 300 ± 24 px. O único efeito desenhado no ponto gravado vem da spritesheet, sem círculo adicional.
