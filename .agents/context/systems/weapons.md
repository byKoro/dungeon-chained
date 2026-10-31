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
- `playReconnect(scale = 0.5)`: the first reconnect after the forge uses `SAW_CINEMATIC.firstReconnectScale` (1,1). `drawAt(ctx, x, y, { rotation, sx, sy })` draws a loose disc for the cinematic (the glow circle was removed 2026-10-31).

### Player/dash upgrades — sala "botas" (2026-10-31)
Novas receitas em `FORGE.recipes` (mesma máquina de forja/sucata/rollback; sem pré-requisito de serra). A bigorna da sala `botas` (`inicial.json` 0,1) oferece só estas cinco; `FORGE.bootsRecipes` lista os ids. `Game._applySawUpgrades` também chama `applyPlayerUpgrades(forge, players)` e `coopHeal.setParams(coopHealParams(forge))` (`js/systems/ForgeState.js`); tuning fixo em `PLAYER_UPGRADES` (`ForgeConfig.js`). **Números provisórios, a afinar no playtest.**
- **Passo veloz** (`moveSpeed`, 3 níveis 15/30/50): `player.speedMult = 1 + 0.08·nível`; multiplica a velocidade de andar no `handleInput` (depois do `speedScale` do arrasto).
- **Impacto** (`dashPush`, 2 níveis 20/40): `player.dashPushImpulse` = 12/17 (2026-10-31, era 6/10). `DashPush` (`js/systems/DashPush.js`, update após `combat.updateEnemies`) arremessa inimigos encostados por um jogador em dash, uma vez por inimigo por dash (via `enemy.pushVx/pushVy`, que respeita buracos/paredes); sem dano; ignora imóveis/morrendo/congelados/aéreos. Direção = direção do dash + `contactBias` (0,5) × direção do contato (só o radial jogava o inimigo para trás quando o dash já tinha passado do centro). Enquanto voa: `enemy.pushDamp = launchDamp` (0,9; o padrão do `_applyPush` é 0,85; o `ActionArena` também respeita), distância ≈ impulso/(1−0,9) = 120/170 px, e `MeleeEnemy.launchStagger(launchStaggerSteps 24)` põe o inimigo em `hurt` sem dano (interrompe o ataque e a IA não anda contra o voo). Juice em `DashPushFeedback` (ver visual-effects.md). `justPushed` (flag de um step) fecha o card do Impacto.
- **Vínculo** (`coopHeal`, 2 níveis 40/70): `CoopHeal` (`js/systems/CoopHeal.js`) cura 1 vida de cada jogador que falta quando os dois ficam a ≤ `PLAYER_UPGRADES.coopHeal.radius` (2 tiles) por `seconds` (6→4 s) contínuos, depois `cooldownSeconds` (8 s); o contador reinicia se separam ou tomam dano; só entra em cooldown se curou. Feedback visual em `CoopHealFeedback` (ver visual-effects.md).
- **Fôlego** (`dashCooldown`, 2 níveis 20/40): `player.dashCooldownScale` = 0.75/0.55 multiplica `PLAYER_DASH.cooldownSteps` (`_dashCooldownSteps`).
- **Pés ligeiros** (`dashCharges`, 2 níveis 35/70): `player.dashMaxCharges = 1 + nível`. O dash vira sistema de cargas: `_startDash` gasta uma, `_tickDashCooldown` devolve uma por cooldown; dispara com `dashCharges >= 1`. `dashMaxCharges = 1` = comportamento antigo (um dash). Subir o máximo enche as cargas na hora. `cancelDash` (tackle/porta) gasta uma carga e entra em recarga.

## Pushing the dropped saw (`DroppedSawPush`, config `SAW_PUSH` in `ChainConfig.js`)
- Same eligibility as dragging, and off while `SawDrag` is active. Runs every step in `Game._updateGameplay` after the entity collisions, before wall boxes. No damage: a dropped saw never cuts.
- Body: circle `discRadius · radiusScale` (0,55). A player overlapping it is pushed back by the part the saw does not take (`share` 0,3 of the overlap moves the saw). The player's approach speed adds `transfer` (0,1) to the saw and loses `playerDrag` (0,25). While someone touches it the saw is capped at `maxSpeed` 1,6 px/step, so walking into it moves it slower than the player; released it slides with `friction` 0,88.
- Hard bump (approach ≥ `hardBumpSpeed` 6, e.g. dash/knockback): kick to `approach · kick` (max 6 px/step) for `kickSteps` 10 without the cap, shake 2.
- Each new contact at ≥ `bumpSpeed` 1,2 (cooldown 12 steps): `sawLand` at 1,7 rate / 0,22 volume, 3 sparks on the contact side, a small size pop (`dropT` back by `bumpPop`) and a `dropSpin` kick.
- The static sprite rolls: `rotation += rolled / discRadius` in the direction of horizontal travel; dust every 6 steps while it rolls fast. Walls, holes, bars, stakes, solid props (`Game._sawDragBlocked`) stop it with `wallBounce` 0,3; clamped to the arena.
- Both players reaching it still reconnect through `Chain._canReconnect` (`pickupRadius` 60 > body distance).

## Dragging the saw (`SawDrag`, Editor 2.0 maps, `feat/saw-drag`)
- **Sold at the anvil (2026-10-31):** recipe `drag` ("Arrastar", item, 20, needs the Saw) in `FORGE.defaultRecipes` (in the demo map only the start-room anvil uses the default list). `canDrag` requires `forge.has("drag")` when the map sells it (`Game._mapSellsDrag = mapOffersRecipe(map, "drag")`); maps without an anvil selling it keep dragging free, like the Saw. First purchase shows the `ability.drag` card; the first grab (`justGrabbed`) closes it.
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

### Investida: o tackle precisa da receita (2026-10-31, `feat/tackle-unlock`)
Receita `tackle` em `FORGE.recipes` (`kind: "item"`, `item: "saw"`, `costs: [0]`), primeira do catálogo porque o editor ordena as receitas da bigorna pela ordem do catálogo. Só a bigorna da Penhasco (`inicial.json` 2,1) oferece, na primeira linha; fora de `defaultRecipes`. `SawTackle` recebe `canTackle` (padrão `() => true`) e só inicia um tackle se ele for verdadeiro; o Game passa `() => !mapData || forge.has("tackle")`: nos mapas do Editor 2.0 fica travado até pegar a receita, mesmo em mapa sem ela; o modo clássico (sem forja) segue liberado. Travado, o dash só encosta: empurrão/arrasto seguem iguais, sem feedback de "travado". O Arauto lançando a serra solta não depende da receita. Por ser nível da forja, a morte na sala desfaz (ADR 0014). `ForgeMenu` mostra `forge.free` (GRÁTIS/FREE) no lugar do preço quando custa 0. O teste do editor pode começar com a receita (`test.progress.tackle` → `forge.reset({ items })` em `newDungeon`). Testes: `test_saw_tackle.js` (trava), `test_forge.js` (grátis/pré-requisito).

### Bigorna da Penhasco: melhorias da serra lançada (2026-10-31, `feat/penhasco-forge`)
A Penhasco (`inicial.json` 2,1) vende só o catálogo próprio, `FORGE.penhascoRecipes`: `tackle`, `size2`, `tackleHits`, `ricochet`, `embers`, `tackleLong`, `reconnectBlast` (o catálogo base fica só na inicial). Estão no começo de `FORGE.recipes` nessa ordem porque o editor ordena a bigorna pelo catálogo. Pré-requisito com nível: `item` + `itemLevel` (`ForgeState.status` trava se `level(item) < itemLevel ?? 1`); o aviso vem de `forge.locked.<item>` (`lockedText` em `ForgeMenu.js`, com `{level}`), senão `forge.locked`. Valores provisórios.
- **Tamanho II** (`size2`, 70/100, exige Tamanho 3): +0,12 por nível somado ao Tamanho em `applySawUpgrades` (máx. 1,60×).
- **Mais cortes / Investida longa / Ricochete**: `sawTackleTuning(forge)` devolve só as chaves compradas (`hits` 7/10; `speed` 17/19 + `returnStartSteps` 55/70; `ricochetJumps` 1/2 + `ricochetRange` 300). `SawTackle` recebe `getTuning` e, a cada `_tackle`, monta `this.cfg = { ...baseCfg, ...tuning }`; o lançamento pelo Arauto volta para `baseCfg`. Ricochete: em `_release`, se ainda há pulos e o inimigo solto não é o Arauto, vira para o inimigo `_targetable` mais perto (≤ alcance, sem parede) e pausa o volante da volta (`steerPause`) até chegar; toca `feedback.launch`.
- **Brasa** (`embers`, 50): `js/systems/SawEmbers.js`. Com a melhoria, enquanto `sawTackle.mode === 'tackle'` e `state === 'flight'`, larga uma brasa a cada `spacing` (24 px) com o `launchId` do lançamento; cada brasa vive 1,5 s e solta chamas pequenas (`triggerFlameBurst`). Inimigo a ≤ `radius` (22) + `hitRadius` de uma brasa leva `damage` 1 uma vez por lançamento; `lavaStone` (Arauto) é imune; não fere jogadores. Atualizado logo depois de `sawTackle.update()`.
- **Reconexão explosiva** (`reconnectBlast`, 30/50, exige Serra): `js/systems/ReconnectBlast.js`. `Game._onSawReconnect` chama `onReconnect(x, y, { first })` com a posição da serra conectada; fora da primeira conexão (cinemática) e fora da recarga (3 s) chama `Game._cutWave` (a mesma onda do Estalo, raio 1,6/2,4 tiles).
- Brasa, Reconexão explosiva e Segunda chance resetam junto com o `sawTackle` (nova run, morte na sala, TP, porta). Testes: `tests/test_penhasco_forge.js`.

### Tackle da serra solta (2026-10-31)

`Game` atualiza `SawTackle` antes do Chain e processa os impactos do Arauto após os inimigos. Um dash lança a serra solta com mira assistida inicial; o jogador recebe hit stop local e recuo. A serra quica, prende uma vez por inimigo por lançamento e aplica os hits aceitos configurados (5, intervalo de 0.1 s). `weapon.tackleState` exclui arraste/empurrão duplicados; `sawLocked` impede reconexão durante impacto ou enquanto presa. Novo tackle renova impulso, percurso e alvos.

Mira assistida (2026-10-31): `_assistAim` considera inimigos **e estacas de corda** (`_aimCandidates`). As estacas vêm por injeção `getAimTargets`, ligada em `Game` a `RoomEvents.aimPoints()`, que agrega `CageEncounter.stakeAimPoints()` (estacas não cortadas enquanto o encontro está `active`) e `RopeChests.stakeAimPoints()` (estacas não cortadas). A correção continua única por lançamento, dentro do cone/alcance e sem parede no meio. Corte de cordas pela técnica: `StakeRope.sawGap` passou a enxergar a serra quando `weapon.tackleState` está setado (voo do tackle), então a serra lançada corta estaca de gaiola (encontro ativo), corda com baú e corda com grade — o mesmo corte da serra conectada.

`flightMode: 'return' | 'coast'` é injetado pelo construtor. `return` mantém a volta original e é padrão fora do playtest. `coast` mantém direção/quiques, sem retorno normal ou especial do Arauto; após 600 px de percurso efetivo aplica atrito 0.975/step, até velocidade inferior a 1 px/step ou limite de voo. Soltar inimigo conserva velocidade/percurso. Parâmetros em `SawTackleConfig.js`; seletor no Editor 2.0 (room-editor.md).

Pouso inseguro entra em `landing`, percorrendo `DungeonTileQuery.safeDropRoute` a 4 px/step com verificação de sólidos. Prefere piso afastado de buracos e aceita fallback alcançável; sem rota, tenta novamente a cada 15 steps, sem teleporte. Game revalida a chegada com `reachableDropPoint`; som de pouso só toca ao chegar. Posição já segura, fase, escala e rotação são preservadas. Novo tackle ou reconexão interrompe a aproximação. Fallback de queda forçada (2026-10-31): depois de esgotar as tentativas (`landingMaxRetries`), `_forceLanding` prefere o piso seguro **perto da origem do lançamento** (`safeDrop(origin)` validado por `canLand`) antes de cair onde a serra parou — a serra volta para a área de onde foi lançada e nunca termina num tile inalcançável pelos jogadores.

Attack1 (`attack`) e attack2 lançam no frame `justGroundHit`; slam usa `justSlammed`. Dash (`attack3`, `charging`) verifica o trecho varrido do passo e lança na direção do movimento; os outros golpes lançam radialmente. Só afeta serra solta parada, sem parede no contato. Voo `boss*` tem atrito/quiques próprios, sem retorno, em ambas as versões. Testes: `test_saw_tackle.js` e `test_saw_tackle_landing.js`.


## SawTackle feedback (2026-10-31)
SawTackle emits semantic callbacks into Game-owned SawTackleFeedback while preserving trajectory, targeting, damage, return/coast, cooldown and local hit-stop rules. Its bounded trail stores position plus rotation; drawTrail was removed from the physical system. Rendering uses two rotating edge emitters and segmented ember trails. SawWeapon caches up to eight16px frames shaded as dark steel with heated rims; shared heat crossfades original/warm pixels over0.45 simulation seconds and cools over0.45s after landing. No new character/weapon art is shipped. CombatSystem.feedbackForHit accepts an optional fourth {soundVolumeMultiplier} argument; only tackle passes the reduced gain to leave room for its continuous cutting sound. Existing callers keep default volume.
