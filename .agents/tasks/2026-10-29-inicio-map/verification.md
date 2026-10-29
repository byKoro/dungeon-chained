# Verification — inicio map

## Commands
- `node _local/build-inicio-rooms.mjs` → `validatePlayable: ok` for the whole map (4 rooms, 3 connections).
- `node tests/test_inicial_script.js` → 9/9 (start delay, start lines once, chest 1 vs encounter chest, anvil, gate + right door, no repeat with a fresh script, switch off).
- `npm test` → 30/31 (only the known `test_modular_grid` failure, #5).
- `npm run check` → only the known failures #4 and #5.
- `npx electron _local/verify-inicio.cjs` (normal boot `index.html?skipTrailer` against `python serve.py`, stepped):
  - boot map has rooms `1,1`, `0,1`, `2,1`, `1,0`; starts in `inicial`, without the saw, run rules on;
  - after 60 steps: `talk.start.1` showing, `talk.start.2` queued;
  - doors: `door_0` → 2,1 open, `door_1` → 0,1 open, `door_2` (boss) → 1,0 blocked;
  - near the gate: `talk.bossGate` showing, `talk.rightDoor` queued; capture shows the red light on the gate;
  - through the right door to `penhasco` and back, through the left door to `botas` and back; boss door still blocked; no console errors.

## Not verified
- Real play with keyboard/pad (walking through the doors instead of calling `transitionThroughDoor`).
- The packaged Electron build (`app://`).
- `talk.chest1`, `talk.anvilNear` and `talk.connected.*` in the running game (covered by the unit test / code reading only).
- Sounds.
