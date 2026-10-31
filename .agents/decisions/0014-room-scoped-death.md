# Room-scoped death: respawn in the current room, reset only that room, lose that room's upgrades
Status: accepted (2026-10-31)

Supersedes the current-room part of ADR 0012 for maps with an anvil (`Game._runRules`). Maps without an anvil still show the game over screen.

## Decision
When either player reaches 0 lives, `Game._respawnRoom()` runs (it replaces `_respawnRun`, which sent the pair back to the dungeon start and kept all progress):

- Both players respawn at the **current** room's spawn with full lives, short invulnerability (`RUN_DEATH.invulnSteps`) and a black fade. The dungeon pointer does not move.
- **Only the current room resets.** `RoomManager.resetCurrentRoom()` drops the cached `Room` instance and re-enters the cell, so enemies, the encounter, hazards and the cleared flag return to the authored state; `_activateRoomEnemies` respawns the foes. Other rooms, the blood canvas and the shared scrap pot are untouched.
- **The status gained in that room is lost.** Forge upgrades bought at this room's anvil roll back to the level they were before each purchase (`ForgeState.setLevel`, no scrap refunded); chests opened in this room re-close (`ChestSystem.forgetRoom`); the room's completed encounters and script/rope/cage/bars state are cleared (`RoomEvents.resetRoom`).

Per-room attribution of forge purchases is tracked in `Game._roomForgeBuys` (a `Map<roomKey, {id, prevLevel}[]>`), filled from `_onForgeBuy` and cleared on `newDungeon` (restart).

## Why
The player asked for death to cost only the current room instead of the whole run: you lose the fight and the gear you earned in the room you died in, respawn at its entrance, and try it again, while keeping everything earned in earlier rooms. This is a gentler, more local loop than ADR 0012's "back to the start, keep everything but scrap."

## Consequences
- ADR 0012's run-death contract ("respawn at the start room, scrap resets, items/upgrades stay") no longer describes anvil-map death; it is replaced by this room-scoped rule. Full restart (`newDungeon`) still wipes everything.
- Scrap is a shared run currency, not room status, so it is NOT reset by a room death (unlike the old `_respawnRun`, which zeroed it).
- Forging the saw and then dying in that same room rolls the saw back to level 0 — the pair respawns without the saw, but the room's anvil re-arms so it can be re-forged. Accepted as the literal meaning of "lose the status gained in that room."
- The boss/herald room replays its intro on a room death (the room is rebuilt from scratch). Accepted as faithful reset behaviour.

## Related
`js/Game.js` (`_respawnRoom`, `_rollbackRoomForgeBuys`, `_recordRoomForgeBuy`, `_roomForgeBuys`), `js/rooms/RoomManager.js` (`resetCurrentRoom`), `js/systems/RoomEvents.js` (`resetRoom`), `js/systems/ChestSystem.js` (`forgetRoom`), `js/systems/ForgeState.js` (`setLevel`). ADR 0011 (room events), ADR 0012 (run progression). Tests: `tests/test_room_scoped_death.js`, `tests/test_forge.js`, `tests/test_chest.js`.
