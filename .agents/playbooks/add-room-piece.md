# Playbook: add a room piece

A room piece is one `map/*.json` file listed in `map/index.json`. The game picks a piece per dungeon cell by `type|doorSignature` (`RoomCatalog.pick`). Context: `.agents/context/systems/rooms-and-maps.md` (schema table), `.agents/context/systems/room-editor.md`.

## 0. Decide what you need
- Door signature `{N,E,S,W}` and `type` (`normal`, `start`, `boss`; `challenge` only by hand). `kind` (`room`/`corridor`) only changes the file name.
- Check coverage: editor **Cobertura** button, or count pieces per `type|sig` in `map/index.json`.
- With the current `GRID_COLS=3` the generator only builds a vertical line, so in-game you will only meet: `start` (reframed to N+S), `normal` N+S (corridor cells), and dead-ends `normal` S / `normal` N or `boss` S / `boss` N. Other signatures load but are unused until the grid changes.

## A. Via the editor (preferred)
1. `python serve.py` from repo root → open `http://localhost:8000/editor.html`.
2. Pick the shape with the ◀ ▶ arrows on the canvas sides; press **Nova** for a blank variant (or browse existing ones with the bottom bar).
3. Author with the sidebar cards (Buracos, Tiles de piso, Paredes, Tochas, Props, Traps + lock rule, Inimigos). Keep player spawn tiles clear (editor blocks holes/walls there but does **not** warn about hazards on them): N (6,1)(7,1), S (6,7)(7,7), W (1,3)(1,4), E (12,3)(12,4), center (6,4)(7,4) for start.
4. **Testar** → plays the piece alone at `index.html?playtest=true` (no door exits). Use the Spawns card to pick where players start. Browser Back returns with state restored.
5. **Salvar** → `POST /api/save-room` writes `map/<base>_<i>.json` and appends it to `map/index.json`. It never overwrites: to replace a variant, save the new one, select the old one, **Deletar**.
6. Optionally set `name`/`id` by hand afterwards (editor has no field for them).

## B. By hand
1. Copy a similar piece (same doors) from `map/`, e.g. `map/room_w_0.json` (dead-end W) or `map/corridor_vertical_ns_0.json`.
2. Name it per `serve.py _base_name`: `room_start_hub_<i>`, `room_boss_<i>`, `corridor_horizontal_ew_<i>`, `corridor_vertical_ns_<i>`, else `{room|corridor}_{letters in N,E,S,W order}_<i>.json`. Name must match `^[A-Za-z0-9_\-]+\.json$` so the editor can delete it.
3. Required: `doors` (≥1 true) and `floor` as exactly 9 rows × 14 ints. Keep the frame consistent with `doors`: open door = floor tile (`16`/`17`) at N `row0 col6–7`, S `row8 col6–7`, W `col0 row3–4`, E `col13 row3–4` plus the inner tile behind it; closed side = wall tile. Easiest: start from `RoomTiles`/`applyImmutableFrame` output of an existing piece.
4. Holes: put `-1` in `floor` **and** the `"col,row"` in `holes` (the editor rebuilds floor from `holes`). `-2` = empty dark floor (keep `floorOverrides` in sync, or omit `floorOverrides` entirely and the editor rebuilds it from `floor` on import).
5. Content arrays (`enemies`, `hazards`, `walls`, `torches`, `props`, `scatterProps`, `lock`) per the schema table. Enemy `type` must be a key from `ENEMY_TYPES` in `js/config/EntityConfig.js`.
6. Append the file name to `map/index.json` `rooms` (no duplicates). Unlisted files are never loaded.
7. Fields not consumed from pieces today: `heartCount`, `heartDropChance`, `kind`, `id`, `cols`/`rows` (only for start/boss reframe). Wire them in `RoomManager._applyAuthoredPiece` first if you need them.

## Validate
```
node tests/test_safe_spawn.js
node tests/test_player_spawns.js
node tests/test_hole_resistance.js
node tests/test_modular_grid.js     # currently fails at "Curva SE" (pre-existing, unrelated to map files)
npm run validate:map                # index ↔ files, JSON parse, schema, door frames, spawn tiles, coverage
```
Quick manual check without the validator: open DevTools on the game and look for `[RoomCatalog]` warnings (bad JSON, missing `doors`/`floor`, HTTP 404 for a listed file).

## Verify in game
- `python serve.py` → `http://localhost:8000/` (or `npm start`). Hard reload is not needed (`no-store`), but `RoomCatalog` loads once per page load.
- Run several times: choice is random per run (`runSeed`) and deterministic per cell within a run (`RoomManager._cellRng`).
- Fastest: load the piece in the editor and **Testar**.
- Check: doors open/close per `lock` (`Room.lockRule`), enemies spawn on floor (relocated off holes by `findSafeFloorCell`), no player lands on a hole/hazard when entering from each door, torches light inward, buttons need both players.

## Done checklist
- [ ] File in `map/`, listed once in `map/index.json`.
- [ ] `doors` matches the frame openings; floor is 9×14.
- [ ] `holes` ↔ `-1` consistent; spawn tiles safe.
- [ ] Enemy/hazard types valid; `lock:"buttons"` has ≥2 buttons.
- [ ] Tests above pass (except known modular-grid failure); playtested.
