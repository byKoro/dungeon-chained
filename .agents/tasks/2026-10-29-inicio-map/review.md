# Review — inicio map

Self-review of the diff (map data, `DemoDoors.renderLights`, `InicialRoomScript` lines, `Game._onSawReconnect`).

- Line ids share `RoomEvents.completed` with encounter ids (`talk:*` vs `salao`). No clash today; it keeps "once per run" surviving death without a new store. Accepted.
- The gate pulse uses `performance.now()` like the gate frames (render-only, ignores pause). Accepted.
- `talk.anvilNear` fires even when the forge would not open (enemies alive in the room). In this map no enemies are near the anvil. Accepted.
- `talk.connected.*` depends on `_sawFirstConnect`, which `_respawnRun` clears; dying between the craft and the first connection skips them. Listed in `status.md`.
- No editor code touched; the `EditorApp.js` hard rules do not apply.
