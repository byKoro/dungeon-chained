# Status (snapshot 2026-10-25)

Update this file when you merge a branch, fix a listed bug, or find a new one.

## Open remote branches (not merged into `main`)

Only branches with commits ahead of `main` contain unmerged work. Check before starting a similar feature.

| Branch | Ahead | Author | Content |
|---|---|---|---|
| `origin/inimigos-novos` | 2 | Rodrigo Yamauchi | Two new enemies: cleave demon, frost guardian |
| `origin/branch-inimigo-novo-skull` | 1 | Rodrigo Yamauchi | `FireSkullEnemy` + SpawnSystem/AssetLoader wiring (very old base, ~90 commits behind) |
| `origin/sala-trap-teste` | 2 | Rodrigo Yamauchi | Challenge walkway/fall experiments (old base) |

Fully merged (0 ahead, safe to delete): `arrebentar`, `branch-rodrigo`, `characters`, `chore/reorg-repo`, `inimigo-buraco`, `merge-arrebentar`, `more_spikes`, `paredes`, `pitch`, `room-editor`, `sprite-serra`.

Old-base branches predate the subsystem refactor (ADR 0002): port features into the current architecture instead of merging the old files.

Merged into `main` (fast-forward, 2026-10-26) from `feat/player-dash`, two commits:
- Hole depth: hole art with a lip and wall, plus `HoleEffects`. See `systems/rendering.md` and `visual-effects.md`.
- Individual dash while the chain is snapped. See `systems/players-and-chain.md` → Dash. The `playerDash` sound is a placeholder (pitched `arrow-fire`).

## Backlog
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
11. Lives cap 3 hard-coded in `Game._updateHearts` / `Player` (ignores `HEART_DROP.maxLives`). Chain tuning hard-coded in `Game` constructor.
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
