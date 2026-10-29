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
## Ajuste individual de mobs — 2026-10-27
- `blackKnightB`: tanque lento (4 HP, velocidade 0.8), três ataques em ciclo e animação completa de morte. Teste dedicado aprovado e sprites renderizadas no Chromium. Gate continua com os problemas preexistentes #4 e #5.

## Cultista — 2026-10-28
- `feat/cultist-fire-pillar`: cultista com distância pública ajustável, conjuração fixa no jogador mais próximo (quarta linha) e morte completa (última linha), disponível nos dois editores. Verificado por testes e canvas no Chromium; balanceamento cooperativo real ainda não avaliado.

- Ajuste do cultista: preferredDistance aumentado para 440 px; círculo de marcação removido. Alcance de conjuração ajustado para cobrir a faixa de distância desejada.

- Cultista: preferredDistance ajustado de 440 para 300 px.

## Início — fatia 1 `feat/scrap-chest` (2026-10-29)
Design: `.agents/tasks/2026-10-29-inicio-core-loop/design.md`; task: `.agents/tasks/2026-10-29-scrap-chest/`. Main merged into the branch at `ec14221` (Ghostfire work).
- Done (Editor 2.0 maps only): shared scrap pot with arc/rest/magnet pickups and enemy drops, top-center counter, chests that open by proximity with the amount authored in the editor, anvil and chests solid at their base and y-sorted, `t()` tables (ADR 0013), speech bubbles (`DialogueSystem.say`, debug global `window.dialogue`). `map/demo/inicial.json` got Baú 1 at (21,26) with 10 scrap. `active.json` still points at `demo_campaign.json` (slice 5).
- Placeholders: scrap uses the coin sprite at half pixel size; `scrapPickup`, `chestOpen`, `voiceBlip` reuse trailer wavs. Asset requests: scrap floor sprite + HUD icon, speech bubble art, real sounds.
- Known limits: chests open with interact within 1 tile (straight distance, walls not checked); scrap flies over walls and holes (only clamped to the arena) and can rest in a walled pocket outside the magnet radius; enemies' navigation ignores solid props; dialogue lines are not wired to events yet (script = slice 5); button icons inside bubbles not done; an interact tap that skips a line also triggers a `DemoProgress` interactive in range; the bubble is misplaced in F6 split mode; restart closes opened chests (death rule = slice 4). Scrap left on the floor, and scrap of a chest still opening, is credited when leaving the room.

## Início — fatia 2 `feat/anvil-forge` (2026-10-29)
Branch from `feat/scrap-chest` (needs the scrap pot). Task: `.agents/tasks/2026-10-29-anvil-forge/`.
- Done (Editor 2.0 maps): runs start without cable/saw when an anvil offers the Serra (`demo_campaign.json` has no anvil and keeps the saw); anvil menu with shared cursor and frozen game; recipes per anvil in the editor; Serra (10), Tamanho, Elasticidade, Serra dupla; saw cinematic, saw on the anvil, bigger first reconnect + "SERRA" title; `CHAIN` config (#11, cable part).
- Out of this slice: Peso and saw drag (slice 3), boots and the Boots-room anvil, zones (the menu is blocked by live enemies in the room, not by a zone), the death rule that keeps items (restart clears purchases).
- Known limits: Serra dupla lives in the 204–240 px band, above the strain distance, so it usually lasts until the strain snap (~0,5 s) unless the pair closes in or has Elasticidade; tune when playing. The saw drawn during the cinematic jump is under the darkness. Menu icons and hammer art are missing (text rows, sparks only). `forgeBuy`/`forgeHammer` are trailer placeholders.
- Observed on `demo_campaign.json` (main map, `?skipTrailer`): the pair spawns ~470 px apart and the cable snaps on the first frame. Spawn code was not touched by this slice; not confirmed on `main`.

## Início — fatia 3 `feat/saw-drag` (2026-10-29)
Branch from `feat/anvil-forge`. Task: `.agents/tasks/2026-10-29-saw-drag/`. `feat/scrap-chest` and `feat/anvil-forge` pushed to origin; no PR opened yet (no `gh` CLI on this machine). `feat/room-fog` was discarded at the user's request (last commit `782f9e8`, plus a stash `backup room-fog working tree before discard`).
- Done: drag the dropped saw (hold interact, short cable, slower walk, no dash, snaps after the drag distance, partner arriving reconnects) and the Peso upgrade (2 → 3 → 4 tiles, 40% → 55% → 70%). See `systems/weapons.md` → Dragging the saw.
- Known limits: the short cable art is a placeholder (stroked curves, almost hidden at 46 px); the dragged saw stops at holes/walls instead of sliding around them; holding interact near the anvil or a chest also triggers their tap on the first frame.

## Início — fatia 4 `feat/room-events` (2026-10-29)
Branch from `feat/saw-drag`. Task: `.agents/tasks/2026-10-29-room-events/`. ADRs 0011 (room events) and 0012 (run progression).
- Done: editor zones, bars, encounters, cage/rope interactives; `RoomEvents` + `CageEncounter` + `InicialRoomScript`; Salão encounter in `inicial.json` (zones bigorna/salao/topo, 4 waves per the design, cage at 14,12, ropes 16,15 auto / 3,10 / 4,16 / 27,10, bars at row 18 cols 15–17 and row 9 cols 23–25, Baú 2 with 15 under the cage). The map commit also carries Baú 1 at (22,27), moved by the user.
- Deviations from the design: the north corridor is cols 23–25 in the current map (design said 21–24); loose enemies placed in a room still spawn on entry.
- Known limits: cage, ropes, stakes and debris have hand-made pixel art (`assets/cage/`); the bars are still a procedural placeholder; enemy navigation ignores bars; the dropped enemies do not fall visibly from the cage (shadow + reveal at the landing spot); a room script is keyed by the room name.
