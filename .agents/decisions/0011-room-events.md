# Room events: zones and encounters authored in the editor, logic in a per-room script
Status: accepted (feat/room-events, 2026-10-29)

Editor 2.0 rooms carry data only: `zones` (`{id, col, row, w, h}`), `encounters` (`{id, waves: [[{type, count}]]}`), `bars` (`{col, row}` tiles that close while an encounter runs), and scripted interactives (`cage`, `rope` with optional `auto`). The behaviour lives in code: `RoomEvents` (`js/systems/RoomEvents.js`, built in `Game`) picks a script by the room name (`ROOM_SCRIPTS`, e.g. `inicial` → `InicialRoomScript`) and gives it a small API (zones, `bothInZone`, encounters, `spawnEnemy`, bars, chests, dialogue, scrap, completed set). Reusable pieces such as `CageEncounter` are plain classes the script composes.

Why: the encounters in the design are set pieces (a cage that tilts, ropes cut by the cable, waves in cut order). A generic trigger/action editor would be large and still not express them; code is shorter and testable, while positions and wave contents stay editable in the editor.

Consequences:
- Enemies placed directly in a room still spawn on entry (keeps `demo_campaign.json` working). Encounters are additional; rooms meant for encounters simply have no loose enemies.
- A room's script is keyed by its name: renaming the room in the editor disconnects the script.
- Completed encounters are stored by `RoomEvents.completed` (`roomKey/encounterId`); `newDungeon` clears them, death does not (ADR 0012).
