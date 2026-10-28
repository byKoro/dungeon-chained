# Verification — boss gate redesign

Approved asset: `assets/doors/boss-gate-opening-strip-v8.png`.

Run:
- `npm run assets:report -- assets/doors/boss-gate-opening-strip-v8.png --expect-size 128x32 --require-alpha` → PASS (alpha present).
- `npm test` → 9/10; `test_modular_grid.js` fails the same way with the change stashed (pre-existing).
- `npm run validate:map` (see final report).
- Offline composites (`preview_v5.py v8`) over wall tiles 0–5, side walls 10/15, floor 16, background 78 and corridor stub 17.

Not verified:
- The running game: Electron is not installed in this checkout (`node_modules/electron` missing) and no browser was driven. Placement in `DemoDoors` (x = door.x − TILE, y = rect.y − TILE, 2×2 tiles) is read from code, not observed.
- The room editor still shows the boss door as a pink marker (`DOOR_TYPES.boss.sprite` is null); unchanged.

## Draw order + pillar collision (2026-10-27)

- Node simulation calling `RoomManager.prototype.clampPlayer` / `playerAlignedToDoor` on the boss door of `map/demo/demo_campaign.json` (room 1,1, door x 448, minY 64, hitRadius 14, walking north 160 px):
  - dx 0 → passes (y − minY = −70); dx 30 and −40 → pass, clamped to ±30;
  - dx 50 and −58 (over the pillars) → stop at y − minY = 14, like the wall;
  - a normal door at dx 50 still passes.
- `npm test` 9/10 (pre-existing `test_modular_grid.js`). Diagnostics clean on the four touched JS files. `npm run graph` rebuilt.
- Not verified: the draw order in the running game (no Electron/browser here).
