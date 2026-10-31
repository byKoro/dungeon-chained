# dash hole assist room death

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/cage-visual-editor  Base: 0ffcd3b  Date: 2026-10-31

## Goal
Make holes more forgiving with the dash and make death feel less punishing:
1. A dash gets a landing assist + a short grace window so the pair clears holes
   without needing to be pixel-perfect on the edge.
2. A player that falls into a hole but still has lives respawns near the hole;
   only a final death (0 lives) sends them to the last player spawn.
3. On a full death (anvil maps), the pair returns to the CURRENT room's spawn,
   only that room resets (enemies/encounter re-armed), and the status gained in
   that room (forge upgrades bought at its anvil, chests opened in it) is lost.

## Context read
- .agents/context/architecture.md, conventions.md, decisions/0012-run-progression.md
- js/Game.js (_resolveFall, _respawnRun, _rememberEntrySpawns, _onForgeBuy, _updateGameplay)
- js/rooms/DungeonTileQuery.js (checkHoleFalls, feetInHole, _holeEdge, ensureSafeSpawn, safeDropPoint)
- js/entities/Player.js (dash, startFalling, respawnAt, holeGrace)
- js/rooms/RoomManager.js, js/rooms/Room.js, js/rooms/AuthoredDungeon.js
- js/systems/RoomEvents.js, ForgeState.js, ChestSystem.js, ScrapWallet.js
- js/config/GameConfig.js (HOLE_FALL, PLAYER_DASH), ForgeConfig.js, ScrapConfig.js

## Steps
- [ ] 1. Dash-over-hole assist.
      Files: js/config/GameConfig.js (PLAYER_DASH.holeGraceSteps, holeLandAssistTiles),
             js/entities/Player.js (set holeGrace when a dash ends), 
             js/rooms/DungeonTileQuery.js (skip falls during grace; snap a landing
             over a hole to the nearest safe floor within tolerance).
      Verify: npm test; reason through edge cases.
- [ ] 2. Respawn near the hole when lives remain.
      Files: js/Game.js (_resolveFall uses p.fallX/fallY + ensureSafeSpawn).
      Verify: npm test.
- [ ] 3. Full death = current-room reset + lose that room's status.
      Files: js/Game.js (_onForgeBuy records per-room buys; new _respawnRoom path;
             chests opened per-room rolled back), js/rooms/RoomManager.js (resetCurrentRoom),
             js/systems/RoomEvents.js (resetRoom), js/systems/ChestSystem.js (reopen/forget room),
             js/systems/ForgeState.js (rollbackTo). New ADR 0014.
      Verify: npm test; new focused test.
- [ ] 4. Gates + docs.
      Files: .agents/context/systems/*, status.md, decisions/0014-*.md
      Verify: npm test, npm run validate:map.

## Docs to update when done
- [ ] .agents/context/systems/players-and-chain.md (dash hole assist), combat-and-entities.md or rooms-and-maps.md (room death)
- [ ] .agents/context/status.md
- [ ] ADR 0014 (room-scoped death — structural, overrides parts of 0012 for the current-room case)
