# inicio map

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/inicio-map  Base: d2a1832  Date: 2026-10-29

## Goal
Slice 5 of the Início design (`2026-10-29-inicio-core-loop/design.md` §9): the game boots into `inicial.json`, its three top doors lead somewhere (placeholder rooms for Botas and Penhasco, a locked boss room), the boss gate is highlighted while locked, and the dialogue script of §6 is wired.

## Context read
- design.md §1, §3, §6, §9, §10; handoff.md
- js/rooms/DemoMapLoader.js, MapConnections.js (`validatePlayable`), AuthoredDungeon.js (`doorsOf`, `blocked`)
- js/systems/DemoDoors.js, DialogueSystem.js, RoomEvents.js, CageEncounter.js, ChestSystem.js, Game.js (`_onSawReconnect`, `_respawnRun`, render order)

## Decisions (assumed, reported to the user)
- Room grid: `0,1` Botas (left door), `2,1` Penhasco (right door), `1,0` boss room behind the gate. All 14×9, empty, with one door back.
- Both side doors are open (design: the right door is the intended path, the left leads to the Botas room). The boss connection has `requires: "bossKey"`, which nothing grants yet, so it stays locked.
- Each script line plays once per run (kept in `RoomEvents.completed`, so death does not repeat it). The gate line and "Vamos pela direita." play together, as an exchange, when a player gets near the gate.

## Steps
- [ ] 1. Placeholder rooms + connections in `map/demo/inicial.json`; `active.json` → `inicial.json`.
      Verify: `validatePlayable` has no errors (node), normal boot loads the map in Electron.
- [ ] 2. Boss gate highlight while locked: pulsing red light (`DemoDoors.renderLights`, `DEMO.gateHighlight`).
      Verify: capture near the gate.
- [ ] 3. Script lines: start, chest 1, anvil near, gate + right door in `InicialRoomScript`; connected 1/2 in `Game._onSawReconnect`. Trigger radii in `DialogueConfig.SCRIPT_LINES`.
      Verify: unit test for the room script lines; stepped Electron run.

## Docs to update when done
- [ ] .agents/context/systems/rooms-and-maps.md or room-editor.md (Editor 2.0 connections, stale "N leads to gx,gy-1")
- [ ] .agents/context/systems/ui.md (dialogue script triggers)
- [ ] .agents/context/status.md
