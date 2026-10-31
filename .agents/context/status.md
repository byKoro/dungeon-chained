# Status (snapshot 2026-10-25)

Update this file when you merge a branch, fix a listed bug, or find a new one.

## Open remote branches (not merged into `main`)

Only branches with commits ahead of `main` contain unmerged work. Check before starting a similar feature.

| Branch | Ahead | Author | Content |
|---|---|---|---|
| `feat/anvil-forge` | ~9 on top of `feat/scrap-chest` | Kiro (slice 2) | Start without saw, anvil menu, Size/Elasticity/Double saw, saw cinematic, cable tuning in config. See the Início section below |
| `feat/scrap-chest` | ~10 | Kiro (slice 1 of the Início design) | Scrap, HUD counter, proximity chests, solid props, i18n, speech bubbles. See the Início section below |
| `origin/inimigos-novos` | 2 | Rodrigo Yamauchi | Two new enemies: cleave demon, frost guardian |
| `origin/branch-inimigo-novo-skull` | 1 | Rodrigo Yamauchi | `FireSkullEnemy` + SpawnSystem/AssetLoader wiring (very old base, ~90 commits behind) |
| `origin/sala-trap-teste` | 2 | Rodrigo Yamauchi | Challenge walkway/fall experiments (old base) |

Fully merged (0 ahead, safe to delete): `arrebentar`, `branch-rodrigo`, `characters`, `chore/reorg-repo`, `inimigo-buraco`, `merge-arrebentar`, `more_spikes`, `paredes`, `pitch`, `room-editor`, `sprite-serra`.

Old-base branches predate the subsystem refactor (ADR 0002): port features into the current architecture instead of merging the old files.

Merged into `main` (fast-forward, 2026-10-26) from `feat/player-dash`, two commits:
- Hole depth: hole art with a lip and wall, plus `HoleEffects`. See `systems/rendering.md` and `visual-effects.md`.
- Individual dash while the chain is snapped. See `systems/players-and-chain.md` → Dash. The `playerDash` sound is a placeholder (pitched `arrow-fire`).

## Backlog

Integration prepared for `main` and `boss` (2026-10-28): merged current main with Ghostfire size/pacing adjustments. Kept cultist/FireSkull spawning and combat hit feedback; Ghostfire implements `takeHit` and local hit stop, and its effects/lights exclude other boss types. Focused regression coverage is in `test_ghostfire.js`. Pre-existing local edits remain outside this merge.

Adjusted on branch `boss` (2026-10-28): Ghostfire's beam attack is slightly slower: wait 108, charge 30, warning 33, recovery 54 ticks. Charge plus warning now takes 1.05s (previously 0.83s). Active beam duration remains 30 ticks. Gameplay feel has not been verified in a browser.

Adjusted on branch `boss` (2026-10-28): Ghostfire now shares the trailer's integer 21× sprite scale (previously 8× in gameplay); its beam width follows that scale at 63 world pixels, and hit radius scales proportionally to 115.5 pixels. Browser appearance has not been verified.

Implemented on branch `boss` (2026-10-27): Ghostfire now reuses the opening trailer sprite geometry, pixel-art beam and audio, with staggered summons, charge/locked warning, alternating sides and full death animation. Weapon hits respect its health/cooldown. See `systems/combat-and-entities.md` and task `2026-10-27-ghostfire-trailer`. Existing unrelated working edits were preserved outside the focused boss commit. All 12 local test files pass; the isolated commit has 10/11 passing with baseline issue #5 still present. Map validation still fails on known issue #4. `graphify` is unavailable (`npm run doctor`).
- `.agents/backlog/prop-shadow.md` — dynamic prop silhouette shadows (design approved, not implemented).

## Known bugs / gotchas (verified 2026-10-25)

Generation & rooms
1. `GRID_COLS = 3` makes `DungeonGraph` always build the same 5-cell vertical line (room S · corridor NS · start · corridor NS · room N); `ROOM_COUNT = 8` is never reached and most pieces never appear.
2. No `type: "boss"` pieces exist → boss cell is an empty procedural room. `Room.isBoss` unused.
3. `heartCount` / `heartDropChance` are not copied by `RoomManager._applyAuthoredPiece` → no effect from pieces. Effective heart drop = `HEART_DROP.chance` (15 %), gated by `canDropHeart`.
4. `map/corridor_vertical_ns_1.json` exists but is not listed in `map/index.json` (caught by `npm run validate:map`).
5. `tests/test_modular_grid.js` fails at the "Curva SE" assert: `transformRoomFloor` no longer mirrors CORNER pieces vertically (SE/SW use `lowerBaseFloor`). Decide whether the test or the code is right.
6. `ModularGrid`, `RoomSocket` placement and `RoomPresets` are not used by runtime generation (tests + editor only).
7. Piece `kind` is ignored when matching; `Dungeon` default `roomCols = 13` (overridden to 14).

Combat & entities
8. `MeleeEnemy.setNavigationFloor` ignores its `walls` argument → BFS paths through wall blocks; `findSafeFloorCell` ignores custom walls (enemies may spawn inside walls).
9. Enemy hit plays both `playerHurt` (CombatSystem) and `playerHit` (Game) — same wav set, doubled.
10. Dead code: `MeleeEnemy` "dead" state, `Chain.applyToEnemies`, `Chain.cycleWeapon`, `Weapon.hitsTarget`, `HAZARDS.spike.*Frames`, `ParticleSystem.triggerExplosion`, `BloodCanvas.stampGib`, `PostProcessor.addAreaLight`, `TORCHES.minPerWall/...`. (`preloadUi` is used again by the trailer.)
11. Lives cap 3 hard-coded in `Game._updateHearts` / `Player` (ignores `HEART_DROP.maxLives`). ~~Chain tuning hard-coded in `Game` constructor~~ moved to `js/config/ChainConfig.js` on `feat/anvil-forge`.
12. Cable hit uses the straight p1→p2 segment, not the drawn sagging cable; a still saw also kills.

Audio, UI, editor
13. `monsterHurt`, `enemyAttackVoice` cues are `enabled: false` with no files. Missing assets for the saw-hit feel: an enemy wound sound and a heavier poise-break impact (a poise break currently reuses `sawHit`, lower and louder).
14. `R` restarts instantly at any time (even paused); `T` cycles tileset (debug). Debug globals `window.audio`, `window.audioConfig`, `window.sawMotor`, `window.playerAI`.
15. `AssetLoader` requests `tileset_1..6` but only `tileset_1.png` exists (404s).
16. Editor hazard-on-spawn warning never shows (`#spawn-warning-box` missing); Save never overwrites (duplicates); import rebuilds `floor` (hand-edited tile values lost).
17. `serve.py` has no auth and binds all interfaces: anyone on the LAN can write/delete `map/` while it runs (now also `map/demo/` via `/api/save-map`). Dev-only; never expose it.
18. ~~Opening trailer missing~~ Fixed on `fix/restore-trailer` (2026-10-26): `9b13c52` had deleted `js/trailer/` as dead code although `main.js` played it at boot. Restored only the boot trailer (no `trailer.html`/`b3`/`matchcut`); see `systems/ui.md` → Opening trailer.
19. ~~Trailer gamepad gaps~~ Fixed on `feat/gamepad-ui` (2026-10-26): gate, SKIP, START, both pauses and the death screen work with a pad (`MenuPad`). Remaining limit: in a browser, a pad-only player gets the trailer muted (pad buttons don't unlock audio). The game's `AudioManager` also stays suspended until a key/click. Electron is not affected.
20. Editor 2.0 on branch `novo_editor`: the game now loads the full map (`?editor2=true` test, or `map/demo/active.json` as main map) with variable room sizes, door-to-door connections, room locks, interactives and the boss gate. Verified by script in Electron; see `.agents/tasks/2026-10-26-editor2-demo-scope/verification.md` for what was not exercised (camera comparison, real input, saw ricochet/damage, packaged build). Lever/bridge, thrown saw and rope/key were exercised in game.
21. Saw-hit game-feel (branch `feat/combat-hit-gamefeel`, `.agents/tasks/2026-10-27-combat-hit-gamefeel/`): the new impact feedback (flash, directional sparks/blood, damage number, hit stop, stagger/poise) only runs for the connected cable/disc hits resolved by `CombatSystem` with `hitFeedback: true`. Not covered: `ThrownSaw` hits (call `takeHit()` without impact info, so no stagger/feedback), `FireSkullEnemy` (own `takeHit`, keeps its alpha blink, no flash/knockback/poise), and the trailer scenes (feedback intentionally off).
23. Armadilhas (`.agents/tasks/2026-10-27-editor2-hazards/`): flecha leste/oeste ficava "no ar" (cabeça do lançador sobre a metade escura do tile) e a fileira de espinhos do editor 2.0 não gravava `wave` (disparava toda junta). Corrigido; a flecha norte/sul não foi alterada. Não coberto: flechas em salas de peças antigas (`map/*.json`) também passam a ser deslocadas no jogo (mesma arte de parede), sem conferência visual em jogo real com iluminação.
22. Editor 2.0 enemy picker (`.agents/tasks/2026-10-27-editor2-enemy-picker/`): the content panel only offers the enemies in `EDITOR2_ENEMY_KEYS` (`js/editor2/ContentCatalog.js`: demon, bloodMonster, blackKnightB); add keys there as each enemy is finished. Maps that already contain other types (assassin, tank, fireSkull...) still draw and can be erased. Interactives have no sprite, so their thumbnail is color + symbol. No automated DOM test for the panel (checked by script in headless Chrome).

23. Boss gate art replaced (2026-10-27): `assets/doors/boss-gate-opening-strip-v8.png` (4 × 32×32 frames in a row, transparent passage) replaces the generated v1 sheet; `DemoDoors` now draws it at 2×2 tiles over the door columns instead of 3×3, under the entities (`drawGates`, right after the door gradients) instead of over them. Players pass only through the sprite's 88 px opening (`passHalfWidth` = `DEMO.gatePassHalfWidth` 44); the pillars block like wall. Collision checked by a node simulation on `demo_campaign.json`; art and draw order not yet observed in the running game. Drafts and scripts: `.agents/tasks/2026-10-27-boss-gate-redesign/`.
24. Barra do Arauto e dano acumulado (`feat/boss-bar-damage-combo`, `.agents/tasks/2026-10-29-boss-bar-damage-combo/`): barra no estilo do RESUME com pingos de lava e sem chamas; total de dano por inimigo acima dos números individuais. A serra arremessada continua sem números nem total (precisa de rework, ver #21). Conferido em captura do jogo clássico com o golem colocado por script e golpes chamados direto em `_hitFeedback`; sem luta real contra o Arauto no mapa da demo.

## Ajuste individual de mobs — 2026-10-27
- `blackKnightB`: tanque lento (4 HP, velocidade 0.8), três ataques em ciclo e animação completa de morte. Teste dedicado aprovado e sprites renderizadas no Chromium. Gate continua com os problemas preexistentes #4 e #5.

## Cultista — 2026-10-28
- `feat/cultist-fire-pillar`: cultista com distância pública ajustável, conjuração fixa no jogador mais próximo (quarta linha) e morte completa (última linha), disponível nos dois editores. Verificado por testes e canvas no Chromium; balanceamento cooperativo real ainda não avaliado.

- Ajuste do cultista: preferredDistance aumentado para 440 px; círculo de marcação removido. Alcance de conjuração ajustado para cobrir a faixa de distância desejada.

- Cultista: preferredDistance ajustado de 440 para 300 px.

## Sanctuary cinematic bars - 2026-10-28
Planning: design/demo/02-santuario-do-dash.md. Branch feat/cinematic-bars: reusable bars integrated only into the trailer (0.4 s entry, 0.18 s exit before game startup). Room remains planned; Dash unchanged. Timing and trailer integration tested; visual inspection pending. Graphify unavailable; check retains failures #4/#5.

## Flame Golem - 2026-10-28
Branch feat/flame-golem: approved provisional melee baseline (6 HP, speed 0.8, three cycling attacks, full death), available in both editors. Existing asset/crop/scale preserved. Task: 2026-10-28-flame-golem. Tests and actual Chromium draw passed; co-op balance pending. Sanctuary room and final herald moveset not implemented. Check retains #4/#5; graphify unavailable.

## Flame Golem abilities - 2026-10-28
Three configurable abilities and two HP phases implemented on feat/flame-golem. Config: FlameGolemConfig.js. Default phase threshold 3 HP; phase one one slower charge; phase two two charges and faster movement/animations. Large AoE hits both players and can push into holes. Real Game test in the user's sanctuary room confirmed a fall; screenshot _local/golem-abilities-game.png. Tests pass apart from #4/#5, graphify unavailable. Balance/human co-op pending. No authored map changes, bridge, altar or intro implementation in this task.

## Arauto das Brasas — 2026-10-28 (`feat/flame-golem`, `.agents/tasks/2026-10-28-arauto-das-brasas/`)
- Implementado e testado por script: superarmor (sem stagger/empurrão/hit stop), 100 HP, escala 2×, fase 2 em 50 HP com três saltos com slam, morte lenta com escombros (sem gibs), barra de chefe inferior e vida infinita de teste (editor 2.0 + botão/F7 no teste). Detalhes em `systems/combat-and-entities.md`, `systems/ui.md`, `systems/room-editor.md`.
- Aprovado mas ainda só sugerido: números de balanceamento (`hitCooldownSteps` 10, `secondPhaseHp` 50, `slam.*`).
- Fora de escopo e não feito: ponte após vitória, altar, duas brasas, desbloqueio do Dash, cinemática de montagem.
- Não verificado no jogo real (ver `verification.md`). `npm run check` só falha nos itens antigos #4 e #5.

## Arauto das Brasas — visual (2026-10-29, `feat/flame-golem`, `.agents/tasks/2026-10-29-arauto-visual/`)
- Implementado e testado por script: aviso do ataque pela própria animação (pose de espera) com marcas só para teste (`showMarks`), escala 195 (5x), sombra própria, contorno, luz e brasas, barra de chefe com placa de nome e nova arte. Testes agora leem os valores do config.
- Não visto no jogo: pose de espera, sombra, contorno, luz, brasas e a barra (só uma captura isolada da barra em baixa resolução foi conferida).
- A fase do PC do curso não está no repositório (o editor 2.0 só grava em `map/demo/` com Salvar; o resto fica no navegador daquele PC); será refeita pelo usuário.

## Arauto das Brasas — investida e buraco ao sul (2026-10-29, `feat/flame-golem`)
- Corrigido por script: investida curta quando havia jogador no trajeto (`ignoresEntityCollisions`) e golem pendurado sobre buraco ao sul/fora da sala (`_standsOnFloor` com os pés). Testes novos em `test_flame_golem_abilities.js`. Detalhes em `systems/combat-and-entities.md`.
- Não visto no jogo. `npm test` 21/22 (só `test_modular_grid`, item antigo #4).

## Arauto solid contact � 2026-10-29
- Fixed pass-through caused by immovable excluding the golem from collisions. Players are blocked/displaced by torso, walking and animated arms; cannot push boss, including with saw contact. Airborne slam remains passable.
- Regression tests pass, including charge distance and melee from four sides. Full check retains only #4/#5; graphify unavailable. Game feel/visual alignment not observed. Task: 2026-10-29-golem-solid-body.

## Arauto saw/cable resistance � 2026-10-29
- Saw disc and curved cable now resist grounded golem body/arms, holding player advancement and loading the motor; surface damage remains. Thrown saw rebounds. Infeasible wall pinching disconnects to a safe drop.
- Script tests pass (23/24 total; only old grid test fails). Check also retains old unlisted-map error. Graph refreshed using escalated environment. Gameplay feel and visual alignment not verified. Task: 2026-10-29-golem-chain-resistance.

## Arauto lower hitbox � 2026-10-29
- Lowered torso blocker from y=-16 to +32 and reduced its vertical radius42?30; arms radius24?16 and lift38?12. Passing behind upper sprite remains clear; feet region stays solid.
- Before/after diagram visually inspected: _local/golem-hitbox-comparison.png. Tests pass except existing grid failure; map check retains existing unlisted piece. No live gameplay observed. Task: 2026-10-29-golem-hitbox-lower.

## Softer saw resistance � 2026-10-29
- Implemented approved plan:3% friction, gradual inward resistance,8px compression,2px shared soft correction budget; preserve solid limit and wall pinch handling.
- Removed collision spin loss. Active saw maintains70% minimum spin during cutting; idle contact does not start it. Ordinary enemy hits also sustain motor.
- Tests23/24, only old grid/map check failures. Live co-op feel not observed. Task:2026-10-29-softer-saw-resistance.

## Arauto VFX � 2026-10-29
Approved grilling scope implemented: impact/player shake, local dash trail, blood-free boss debris/embers, phase2 masked flowing lava/drips, safe ~3s cinematic phase transition with bars/zoom/frozen combat/HUD reactions, corrected arms-up hold for attack2 and repeated slam preparations.
Actual hidden Electron Game run verified rendering/state with zero console errors; captures in _local/arauto-*.png. Tests24/25 with only existing grid failure; map check retains unlisted corridor piece. Human co-op feel/performance tuning pending. Task2026-10-29-arauto-vfx.

## Arauto audio � 2026-10-29
Approved grind/whoosh/ground/slam design implemented with11remixed existing-source WAVs and Game-owned ArautoAudio. Ground sounds synchronized even on miss; slam no longer plays player fall, boss saw no longer plays flesh hit, duplicate player damage layer removed for boss. Loop lifecycle tested and realGame output recorded via stream tap. Final mix check in task2026-10-29-arauto-audio; subjective listening pending. Known grid/map failures unchanged; user camera/map edits preserved.

Arauto audio follow-up: strengthened faint grinding by~9.1dB at .7spin and opened its filter. Lifecycle unchanged; tests pass apart from old grid/map failures, re-recorded Game output with no saturated samples observed. Task2026-10-29-arauto-audio.

Arauto timbre revision: removed flame-like contact/dash textures. Contact now dry repeated snaps; dash thick continuous filtered wind. Controllers unchanged, tests and Game recording verified; subjective listening pending. Details task2026-10-29-arauto-audio and audio.md.
## Início — fatia 1 `feat/scrap-chest` (2026-10-29)
Design: `.agents/tasks/2026-10-29-inicio-core-loop/design.md`; task: `.agents/tasks/2026-10-29-scrap-chest/`. Main merged into the branch at `ec14221` (Ghostfire work).
- Done (Editor 2.0 maps only): shared scrap pot with arc/rest/magnet pickups and enemy drops, top-center counter, chests that open by proximity with the amount authored in the editor, anvil and chests solid at their base and y-sorted, `t()` tables (ADR 0013), speech bubbles (`DialogueSystem.say`, debug global `window.dialogue`). `map/demo/inicial.json` got Baú 1 at (21,26) with 10 scrap. `active.json` pointed at `demo_campaign.json` until slice 5.
- Placeholders: scrap uses the coin sprite at half pixel size; `scrapPickup`, `chestOpen`, `voiceBlip` reuse trailer wavs. Asset requests: scrap floor sprite + HUD icon, speech bubble art, real sounds.
- Known limits: chests open with interact within 1 tile (straight distance, walls not checked); scrap flies over walls and holes (only clamped to the arena) and can rest in a walled pocket outside the magnet radius; enemies' navigation ignores solid props; dialogue lines wired in slice 5; button icons inside bubbles not done; an interact tap that skips a line also triggers a `DemoProgress` interactive in range; the bubble is misplaced in F6 split mode; restart closes opened chests (death rule = slice 4). Scrap left on the floor, and scrap of a chest still opening, is credited when leaving the room.

## Início — fatia 2 `feat/anvil-forge` (2026-10-29)
Branch from `feat/scrap-chest` (needs the scrap pot). Task: `.agents/tasks/2026-10-29-anvil-forge/`.
- Done (Editor 2.0 maps): runs start without cable/saw when an anvil offers the Serra (`demo_campaign.json` has no anvil and keeps the saw); anvil menu with shared cursor and frozen game; recipes per anvil in the editor; Serra (10), Tamanho, Elasticidade, Serra dupla; saw cinematic, saw on the anvil, bigger first reconnect + "SERRA" title; `CHAIN` config (#11, cable part).
- Out of this slice: Peso and saw drag (slice 3), boots and the Boots-room anvil, zones (the menu is blocked by live enemies in the room, not by a zone), the death rule that keeps items (restart clears purchases).
- Known limits: Serra dupla lives in the 204–240 px band, above the strain distance. Fixed on `feat/inicio-map` (user choice): while split the strain no longer rises, so only the break distance snaps the cable. The saw drawn during the cinematic jump is under the darkness. Menu icons and hammer art are missing (text rows, sparks only). `forgeBuy`/`forgeHammer` are trailer placeholders.
- Observed on `demo_campaign.json` (main map, `?skipTrailer`): the pair spawns ~470 px apart and the cable snaps on the first frame. Spawn code was not touched by this slice; not confirmed on `main`.

## Início — fatia 3 `feat/saw-drag` (2026-10-29)
Branch from `feat/anvil-forge`. Task: `.agents/tasks/2026-10-29-saw-drag/`. `feat/scrap-chest` and `feat/anvil-forge` pushed to origin; no PR opened yet (no `gh` CLI on this machine). `feat/room-fog` was discarded at the user's request (last commit `782f9e8`, plus a stash `backup room-fog working tree before discard`).
- Done: drag the dropped saw (hold interact, short cable, slower walk, no dash, snaps after the drag distance, partner arriving reconnects) and the Peso upgrade (2 → 3 → 4 tiles, 40% → 55% → 70%). See `systems/weapons.md` → Dragging the saw.
- Known limits: the short cable art is a placeholder (stroked curves, almost hidden at 46 px); the dragged saw stops at holes/walls instead of sliding around them; holding interact near the anvil or a chest also triggers their tap on the first frame.

## Início — fatia 4 `feat/room-events` (2026-10-29)
Branch from `feat/saw-drag`. Task: `.agents/tasks/2026-10-29-room-events/`. ADRs 0011 (room events) and 0012 (run progression).
- Done: editor zones, bars, encounters, cage/rope interactives; `RoomEvents` + `CageEncounter` + `InicialRoomScript`; Salão encounter in `inicial.json` (zones bigorna/salao/topo, 4 waves per the design, ropes with cages at 16,15 auto / 3,10 / 4,16 / 27,10 (redesign: one cage per vertical rope, no central cage), bars at row 18 cols 15–17 and row 9 cols 23–25, Baú 2 with 15 at 14,12, `encounter: "salao"`). The map commit also carries Baú 1 at (22,27), moved by the user.
- Deviations from the design: the north corridor is cols 23–25 in the current map (design said 21–24); loose enemies placed in a room still spawn on entry.
- Known limits: cage, ropes, stakes and debris have hand-made pixel art (`assets/cage/`); the bars got hand-made portcullis sprites (`assets/bars/`, branch `feat/bars-sprite`); enemy navigation ignores bars; a room script is keyed by the room name.
- Game feel pass (2026-10-29): cut only by the saw disc on the stake (highlighted with ring + warm light, stays after the cut); warn → fall → impact with hit stop, shake, zoom punch, flash, dust and a push on the players; enemies jump out of the debris onto reachable floor tiles (BFS on `kinds 'f'`, never across bars, which fixes enemies landing behind walls); the encounter chest falls next to the last cut stake when the last wave dies; ropes/cages drawn under the lighting; Editor 2.0 camera 20% closer (`DEMO.cameraZoom` 1.2). Verified with stepped Electron captures; not play-tested by hand, sounds reuse existing cues (`sawSnap`, `sawLand`, `forgeHammer`, `enemySpawn`, `enemyStep`) and were not listened to.

## Início — fatia 5 `feat/inicio-map` (2026-10-29)
Branch from `feat/room-events`. Task: `.agents/tasks/2026-10-29-inicio-map/`.
- Done: `map/demo/active.json` → `inicial.json` (normal boot plays the Início); placeholder rooms `0,1` botas (left door), `2,1` penhasco (right door), `1,0` boss (behind the gate, `requires: "bossKey"`, so it stays locked); `connections` added so the map passes `validatePlayable`; locked boss gate highlighted with a pulsing red light; dialogue script of design §6 wired (`InicialRoomScript`, `Game._onSawReconnect`), each line once per run.
- Known limits: the placeholder rooms are empty 14×9 rooms (content out of scope); only the boss gate is locked, the Botas and Penhasco doors stay open (user decision); button icons per device in the bubbles are still literal "[E]"; after a run death before the first connection the `talk.connected.*` lines no longer play; `demo_campaign.json` is no longer the boot map (still reachable from Editor 2.0).
- Verified with a stepped Electron run on `http://localhost:8000/index.html?skipTrailer` (served by `serve.py`); not checked in the packaged `app://` build.

## Integrated main and feat/flame-golem (2026-10-29)
Merged main0368672 and Arauto featureb7272f7 locally, preserving both histories. Combined Ghostfire/forge/scrap/chests/events/double-saw with Arauto physics/effects/audio/cinematics. Resolved7files; final tether solver now respects mainprops/bars and split saw uses actualdiscs for collision/audio/damage. Camera preserves featureverticalmargin and mainzoom multiplier. check39/40test suites; only prior gridassert/unlistedmapfailures. Actual mainGameboot and Arauto phase scene rendered without consoleerrors. Task2026-10-29-merge-flame-golem-main. No remote push performed.

## Arauto visual fixes (2026-10-29)
Branch codex/arauto-visual-fixes: removed generated silhouette outline and attack debug marks; stronger attack/impact shake and transient world blur, HUD remains crisp. Focused tests pass; full check retains prior grid/map failures. Task 2026-10-29-arauto-visual-fixes.

## Arauto das Brasas — apresentação refeita (2026-10-29, `.agents/tasks/2026-10-29-arauto-intro/`)
- Cena nova (golem remonta com a morte ao contrário, ergue os braços e bate no chão) substitui a do Codex (`2026-10-29-arauto-entrance-scene`, código removido). Segurar E pula. Faixas no estilo da forja também na fase 2. Expressões no boneco em campo.
- Testado por script (`test_arauto_intro.js`); não visto no jogo. Pendente: avaliar o som provisório `arautoAssemble` e a transição morte→attack2. WAVs `arauto-intro-*` sem uso.

## Início — balões off e grades só com a serra (2026-10-29)
- `DIALOGUE.enabled` and `SCRIPT_LINES.enabled` are `false`: no speech bubbles in the Início (system, script and i18n keys kept; flip the flags to bring them back). `tests/test_dialogue.js` forces `enabled: true` through `cfg`.
- `CageEncounter` starts (bars down, auto rope snaps) only when both players are in the `salao` zone **and** the saw is connected (`chain.isConnected`). After a run death the saw must be picked up again before the bars can drop.

## Início — indicador de interagir (2026-10-29)
- `InteractPrompt` + `assets/ui/interact_prompt.png` (script `scripts/gen-interact-prompt.py`): icon above chests and anvil, per player and per device (keyboard `E`/`⇧`, Xbox `X`, DualShock `□`). Bottom text bars for chest/anvil removed. See `systems/ui.md`.
- Baú 2 (cage reward) no longer opens by itself: it lands closed, the bars rise, and the players open it with interact. `talk.chest2` now plays from `InicialRoomScript` on that open.
- Not verified: I could not open the game, so the icon placement, pop-in and device switch were not seen running; only unit tests (`test_interact_prompt`, `test_chest`, `test_forge_menu`, `test_room_events`, `test_inicial_script`) and the asset contact sheet. Pad detection by `gamepad.id` was only tested with sample id strings.
- Known limits: `SawDrag` still shows its text bar (the feature is being removed); `DemoProgress` interactives (key, lever) still use the text bar.
- White outline on in-range chests/anvil (fade in 6 steps, out 9) and the chest's shine band on the anvil. Not seen in the game: the outline was checked with a PIL reproduction of the same 4-way dilation on the real chest and anvil sprites, not in the browser; how the room lighting darkens it is not verified. While the chest lid opens, the fading outline uses the bottom-centre pivot of the bigger outline rect, so it can drift by 1 world px during the squash.

## Editor 2.0 transparent Tileset tiles (2026-10-30)
Branch codex/transparent-tiles: automatic painting stores transparent non-wall tiles as static decorations above the existing floor. Regression test covers floor preservation, repaint and JSON reload. Existing incorrectly painted cells need floor restoration and repaint. Browser visual verification pending. Full check: 43/44 suites pass; only prior modular-grid and unlisted-map failures. Graphify unavailable.
## Ordem de render de paredes/props — 2026-10-30 (`.agents/tasks/2026-10-30-wall-render-order/`)
- Salas do Editor 2.0: (1) paredes frontais/baixas (tile `41..44`, fora da borda) agora são repintadas em `Renderer.drawFrontWall` no passe da frente — o player fica atrás delas (oclusão total), antes passava por cima; (2) player pode subir `TOP_WALL_CLIMB` (`TILE*0.2` = 12.8 px) a mais encostado nas paredes superiores — `clampPlayer` relaxa `minY` (sem porta N) e `Room` encolhe as `wallBoxes` da linha de topo por cima; (3) os seis props sólidos sem `base` (`box_1/2`, `mini_box_1/2`, `flamethrower_v/h`) ganharam `base` em `PropConfig.js` e entram na ordenação por y, corrigindo o "tapete" (player andava por cima). Bases dos boxes/lança-chamas são ponto de partida, a afinar no playtest.
- Arquivos: `js/config/GameConfig.js` (`TOP_WALL_CLIMB`), `js/config/PropConfig.js`, `js/rooms/Room.js`, `js/core/Renderer.js`, `js/rooms/RoomManager.js`. Doc: `systems/rendering.md`.
- Como a chave de "parede frontal" é o tile `41..44` (não o `side`, que é sempre `'top'` nos mapas do Editor 2.0): se um mapa usar outro tile para parede de baixo, ela não irá para o passe da frente. Não visto no jogo rodando — verificado por `npm test` (42/43, só falha o pré-existente #5 `test_modular_grid`) e `npm run validate:map` (falha só no pré-existente #4 `corridor_vertical_ns_1.json`). Nenhuma falha nova.

## Ordem de render de paredes/props — correção v2 (2026-10-30, mesma task)
A primeira tentativa (acima) não funcionou no jogo: as premissas estavam erradas. Fatos reais (via context-gatherer + `inicial.json`):
- A parede inferior por onde o player passava é a **borda inferior** da sala (tiles `42/44/45` nas 2 últimas linhas), **fora** do `arenaBounds` — nunca virava `wallBox` nem passe da frente. O range `41..44` é só a face frontal de arestas internas; o tile `42` é `top` por default (tabela `wallSideForTile`: top=1..4/50..55, bottom/front=41..44, left=5/15/25/35/45, right=0/10/20/30/40).
- A "estaca" é o interactive `rope` → `CageEncounter`, desenhada em `drawFloor` (antes das entidades) e **sem colisão de player** por design (só a serra corta).
- O climb de 20% usava `isTop = menor row global` — só uma linha de parede ganhava a folga.
- Bug colateral: `AuthoredDungeon` tratava `'v'` (void) como parede sólida → parede invisível sobre tiles vazios.

Correções v2:
- `Renderer.drawFrontWall`: agora repinta as **2 últimas linhas** da sala (moldura de borda inferior) + as arestas internas `41..44`, por cima do player (oclusão total).
- `Room.js`: climb de `TOP_WALL_CLIMB` em **toda** parede com topo exposto (sem parede na célula logo acima), não só na menor row. Removidos os flags `front`/`top` não lidos.
- `AuthoredDungeon.js`: só `'w'` vira parede; `'v'` deixou de colidir.
- `CageEncounter.drawables()` + `InicialRoomScript.drawables()` + `RoomEvents.drawables()`: a estaca entra na ordenação por y (oclui o player quando ele está atrás), **sem** colisão (sombra/anel/destroços seguem no `drawFloor`). Confirmado Q2 = só visual.
- Arquivos: `js/core/Renderer.js`, `js/rooms/Room.js`, `js/rooms/AuthoredDungeon.js`, `js/systems/CageEncounter.js`, `js/systems/RoomEvents.js`, `js/systems/roomScripts/InicialRoomScript.js`. Doc: `systems/rendering.md`.
- Verificação: `npm test` 42/43 (`test_inicial_script` e `test_room_events` passam), `validate:map` só no erro pré-existente #4. Nenhuma falha nova. **Não visto no jogo rodando** — precisa de playtest para confirmar visual das 3 correções e afinar `TOP_WALL_CLIMB`/bordas.

## Ordem de render de paredes/props — v3, conferida no Electron (2026-10-30)
A v2 repintava as duas últimas linhas da sala por cima de tudo e isso escondia os jogadores atrás de tiles de piso; também tinha tirado a colisão do void. As duas mudanças foram revertidas.
- Paredes internas com piso logo acima (`Room.frontWalls`) entram na ordenação por y (`Renderer.wallDrawables`, chave no meio do tile). Paredes internas com piso logo abaixo têm a `wallBox` encurtada por baixo em `TOP_WALL_CLIMB` (12,8 px). O void volta a colidir.
- Visto no Electron (`_local/verify-walls.cjs`, capturas em `_local/verify-walls/v3/`, `inicial.json`, jogadores posicionados por script): os dois ficam atrás da faixa inferior da linha 18 e da borda sul; sobem até y 10,05 tiles diante da parede superior (antes 10,25); a estaca cobre quem está ao norte dela; uma `box_1` e um `flamethrower_v` injetados ordenam pelos pés. Console sem erros.
- Não visto: inimigos encostando nas paredes (a chave deles é `footY`), jogo com controle real, modo split F6, mapas clássicos (o caminho novo só roda com `roomProps`).

## Buraco: queda imediata, resistência fora (2026-10-30)
- `DungeonTileQuery.checkHoleFalls`: pés no tile do buraco (inclusive o lábio iluminado da arte) caem no mesmo step; `graceFrames` saiu. A resistência virou uma faixa de `HOLE_FALL.edgeMargin` (8 → 20 px) no piso antes da borda: freia o passo para dentro e empurra de volta. Esbarrão segura; insistir derruba em ~16 steps (antes ~18).
- Mudança de jogo: knockback cheio (16) a 10 px da borda agora derruba (antes a tolerância interna segurava). `test_hole_resistance.js` reescrito para o comportamento novo.
- Visto no Electron (`_local/verify-hole.cjs`, `inicial.json`, buraco 26–28 × 15–16): parados na faixa não caem e são empurrados para o piso; pés 2 px dentro do tile caem na hora. Inimigos não usam este código (não verificado se têm regra própria).

## Estaca sólida e serra largada empurrável (2026-10-30)
- Estacas do encontro da gaiola bloqueiam os pés de jogadores e inimigos (`CageEncounter.solidCircles`, `RoomEvents.resolveCollisions`) e a serra largada. Continuam cortáveis pela serra.
- Serra largada vira corpo leve (`DroppedSawPush`, `SAW_PUSH`): o jogador esbarra e ela desliza devagar, rola no sprite parado, sem dano; dash/knockback chuta mais longe. Esbarrão tem som baixo (`sawLand` agudo), faíscas, pop de escala e giro. O `_sawDragBlocked` agora também considera estacas e props sólidos (vale para o arrasto).
- Visto no Electron (`_local/verify-saw-push.cjs`, tecla `D` real via `sendInputEvent`, `inicial.json`): P1 subindo contra a estaca (3,10) para em y 10,84 tiles; segurando `D` 1,5 s a serra anda ~0,95 tile e gira ~2,2 rad, sem dano nem reconexão com o P2 longe; esbarrão de 10 px/step leva a serra ~0,55 tile. Som do esbarrão não ouvido.
- Não visto: inimigos encostando na estaca, os dois empurrando ao mesmo tempo, serra empurrada contra parede/buraco no jogo (só a função de bloqueio foi consultada).

## Stair connections (2026-10-30)
Tile 39 and the Escada door choice create interior connection endpoints. Reuses map connections, locks/requirements, fade and safe arrival. Tests pass; browser/game visual behavior not observed. Full check retains prior modular-grid and unlisted-map failures; graphify unavailable.

Stair follow-up: placement on standard border walls supported on N/S/E/W, with approach opening and safe spawn. Four-edge regression and resizing pass. Corners remain excluded. No visual runtime observation.

## Arrow wall impacts (2026-10-30)
Branch codex/arrow-wall-impact: arrows stop at internal/perimeter walls and emit light configured sparks. Swept collision avoids tunneling; launch-wall exit remains allowed. Regression tests pass; visual runtime verification pending. Full check retains the known modular-grid and unlisted-map failures.

## Dash com a corrente conectada — 2026-10-29 (`feat/dash-connected`)
- Dash liberado também com a corrente conectada (mesmo desbloqueio do altar na demo; quem arrasta a serra continua sem dash). Distância 144 px (2,25 tiles, `durationSteps` 12). Conectado, `DashTether` freia o dash a 220 px do parceiro e `Chain` congela a tensão durante o dash, então o dash não arrebenta o cabo. Detalhes em `systems/players-and-chain.md` → Dash.
- Vãos de 2 tiles agora atravessáveis saindo colado na borda: `demo_map.json` sala `4,3`, `inicial.json` sala `1,1`. Revisar no playtest.
- Testes: `test_dash_connected.js` (novo) e `test_player_dash.js` passam. Sensação de jogo não observada (sem playtest real).
- Achado: `test_arauto_effects.js` falha em `main` desde `7c03a12` porque `FLAME_GOLEM.telegraph.showMarks` está `true` e o teste espera `false` (marcas de debug). Não mexido nesta branch.

## Arauto reativo — 2026-10-31 (`feat/arauto-reactive-ai`, `.agents/tasks/2026-10-31-arauto-reactive-ai/`)
- Ciclo fixo de ataques trocado por decisão pela situação (melee perto, pancada por pressão de 2 s na fase 1, investida/salto validados contra paredes, buracos e borda) e perseguição que considera o corpo e os pés. Modos `single`/`sequence` em `FLAME_GOLEM.ai.chainMode`. Detalhes em `systems/combat-and-entities.md` → Arauto reativo.
- Testado por script (`test_arauto_ai.js` + testes do golem atualizados). Não jogado: sensação de combate, quinas com o corpo grande e travessia de buraco no jogo real ficam para playtest.
- `test_arauto_effects.js` continua falhando só pelo `showMarks: true` (já estava assim na `main`).

## Arauto random attacks (2026-10-30)
- Follow-up on feat/arauto-reactive-ai: removed proximity pressure; nearby attack1/attack2 use equal random chances in both phases. Phase 2 also chooses equally between valid dash/jump at distance. Terrain checks, windups and recoveries preserved.
- Regression: immediate attack2 can start in either phase and a valid dash no longer suppresses the phase 2 jump. Existing terrain/sequence tests pass. Runtime combat feel not observed.
- Full gate retains pre-existing effects showMarks mismatch, modular-grid failure and unlisted corridor map. Graphify unavailable. Task: .agents/tasks/2026-10-31-arauto-random-attacks/ (folder date generated by host clock).

Arauto follow-up (2026-10-30): restored fixed warning marks and old gentle dash steering (0.025), with safe-route validation before turns. Default chainMode now sequence: phase 2 uses 3 jumps or 2 dashes, phase 1 still 1 dash. Tests cover default counts, fixed marks and exact tracking angle. Runtime feel remains unobserved.

Arauto distant pursuit variety (2026-10-31): valid ranged decisions choose attack (60%) or committed walking pursuit (40%, 1..1.75 s). No per-frame re-roll; near attacks interrupt pursuit. Phase 2 keeps dash/jump variety and multi-attack sequences. Deterministic update tests cover walking in both phases, no re-roll, renewed dash and nearby reaction. Combat feel not observed in-game.

Arauto attack repetition memory (2026-10-31): near attack1/attack2 choices now reduce the last used attack weight progressively (repeatWeight 0.35 per streak). Retreat/re-entry retains memory. Repetition stays possible; no fixed alternating pattern. Regression covers both phases, real recovery and retreat, allowed repeats and stronger penalty after repeats. Runtime feel remains unobserved.

Arauto nearby action variety (2026-10-31): nearby decisions now mix adaptive attack1/attack2 (60%), short walking pursuit (25%,0.4..0.9s) and safe dash targeting the nearby player (15%). Separate nearby walking commitment avoids per-frame attack retries. Ranged pursuit, repeat memory and phase2 sequences preserved. Regression tests cover both phases and unsafe dash fallback. Runtime feel not observed.

### Tackle da serra — playtest (2026-10-31)

Na branch `feat/tackle-serra`, Editor 2.0 permite comparar retorno à origem e voo que desacelera após 600 px acumulados. O jogo normal conserva o retorno. Attack1, attack2, dash e slam do Arauto lançam a serra solta. Pouso em ponto inseguro agora percorre rota até piso alcançável, sem teleporte ou reinício de escala.

Regressões e integração em Electron passaram (seleção das duas versões e pouso gradual); sensação em co-op ainda depende de playtest manual. Histórico em `.agents/tasks/2026-10-31-saw-tackle-flight-variants/`, `2026-10-31-saw-tackle-smooth-landing/`, `2026-10-31-boss-launches-loose-saw/` e `2026-10-31-saw-safe-landing-route/`.

Check permanece bloqueado pelas falhas de Arauto (`test_arauto_effects`, asserts chase/windup intermitentes), Curva SE e peça `corridor_vertical_ns_1.json` não listada. Arte experimental sem carregamento e ferramentas temporárias ficam em `_local/tackle-unused/` (ignorado pelo Git); não fazem parte da implementação atual.


## Tensão da corrente — 2026-10-31 (feat/chain-tension-juice)
Feedback compartilhado de carga/risco com antecipação, brilho vermelho gradual acima da iluminação, vibração do cabo, rangido crescente, alívio rápido e recuo na ruptura. Reutiliza raiva/furia originais no personagem/avatar; preserva dano/cinemáticas e as proteções de dash/serra dupla. Artes geradas foram rejeitadas e removidas com as ferramentas temporárias.

11/11 testes focados e Game real no Electron passaram; capturas conferidas, console sem erros, gravação com motor/ambiente/impactos com pico0.3603 e nenhuma amostra saturada. Escuta humana/co-op pendentes. Task:2026-10-31-chain-tension-juice.

Gate da implementação:54/56. ArautoEffects/Curva SE e mapa não listado são falhas da base; chase/windup em test_arauto_das_brasas e test_flame_golem também se reproduzem de forma intermitente em main41aace2. Doctor encontra Python indisponível e graphify fora do PATH.


## SawTackle gamefeel — 2026-10-31 (feat/saw-tackle-gamefeel)
Implemented heavy-machine feedback: dedicated seven-cue audio, impact/cut pulses, rotating edge ember trails and dark steel/red/yellow thermal palette. Latest user steering: idle-level brightness with a gradual original-color→red transition; stronger contact glow only. Physical damage/trajectory/return/dash timing preserved. Seven focused feedback cases and existing tackle/landing regressions pass. Actual Game/Electron exercised five accepted hits on flesh/stone, pause silence, ricochet/landing and reset; no blood on stone, no console errors or saturated samples. Capture peak0.8261 before master. Subjective audio/co-op and real-GPU performance pending. Task2026-10-31-saw-tackle-gamefeel. Gate55/57 retains ArautoEffects/Curva SE and the known unlisted map; graphify unavailable.
