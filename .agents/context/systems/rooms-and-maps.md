# Rooms, dungeon generation & map pieces

## Purpose
Builds the dungeon (grid of cells → rooms + corridors), fills each cell with an authored **room piece** from `map/*.json` chosen by door signature, and runs the per-room lifecycle (populate, lock/unlock, enemy spawn, door transition). Piece *content* is fixed; randomness is only *which* piece fills a slot.

## Files
| File | Role |
|---|---|
| `js/core/DungeonGraph.js` | `DungeonGraph.generate()`: random scatter + Prim + carved corridors → `{cols, rows, cells: Map, rooms, edges, start}`. Also `_generateFromLayout(layout)` (validated v1 layout; **not wired** at runtime). |
| `js/core/Dungeon.js` | Cell geometry (`cellBounds`, `cellRect`, `cellCenter`, `doorsOf`), current cell, `visited`/`cleared` sets, `moveTo`. |
| `js/core/RoomTiles.js` | Procedural 14×9 frame (walls, door gaps, `doorCells`). Base for every `Room.tiles`. |
| `js/rooms/RoomCatalog.js` | Loads `map/index.json` + pieces; index by `type|N,E,S,W`; `pick()`; `doorSignature()`. |
| `js/rooms/RoomManager.js` | Owns `Dungeon` + `Map<key, Room>`; `reset()` (also editor playtest), `_applyAuthoredPiece`, `enter`, `transitionTo`, player/enemy clamping. |
| `js/rooms/Room.js` | Per-room state: `tiles`, `enemies`, `hearts`, `challenge`, `cleared`, `lockRule`, `populate`, `spawnEnemies`, `isLocked`, `tryClear`. |
| `js/rooms/RoomArchetypes.js` | `applyImmutableFrame`, `detectShapeFromDoors`, `GlobalRoomVariantCatalog` (procedural fallback floors). |
| `js/rooms/RoomSocket.js`, `ModularGrid.js`, `RoomPresets.js` | Socket-based placement model (`RoomSocket`, `RoomTemplate`, `PlacedRoom`, `ModularGrid`). Used by tests + editor (`RoomSocket`, `RoomPresets`); **not used by runtime generation**. |
| `js/rooms/SafeSpawn.js` | `isSafeFloorCell`, `findSafeFloorCell` (enemy spawn relocation). |
| `js/rooms/DungeonTileQuery.js` | Tile queries on current room: holes, fall physics, `ensureSafeSpawn`, `safeDropPoint`. |
| `js/systems/ChallengeCorridor.js` | Builds hazards (`spike`, `spikeRow`, `arrow`, `button`) for a room; `solved` when ≥2 buttons held `HAZARDS.challenge.holdFrames`. |
| `js/systems/SpawnSystem.js` | `createEnemy(x, y, floor, type)` → `MeleeEnemy` from `ENEMY_TYPE_BY_KEY[type]`, else random melee. |
| `js/config/GameConfig.js` | `TILE=64`, `ROOM_COLS=14`, `ROOM_ROWS=9`, `GRID_COLS=3`, `GRID_ROWS=7`, `ROOM_COUNT=8`, `HOLE_TILE=-1`, `EMPTY_FLOOR_TILE=-2`, `PLAYER_DOOR_SPAWN_TILES`, `PROP_SCATTER`, `scatterPropsOnFloor`, `HEART_DROP`. |
| `map/index.json`, `map/*.json`, `map/README.md` | Piece list + pieces (README is pt-BR, partially stale). |

## Key types & APIs
- **Cell** (from `DungeonGraph`): `{gx, gy, kind: "room"|"corridor", type?: "start"|"normal"|"boss", doors:{N,S,E,W}}`. Corridor cells have **no `type`**. `RoomManager._applyAuthoredPiece` adds `customFloor, customWalls, customTorches, customProps, customEnemies, customHazards, customLock, customName` and `_authored`.
- `doorSignature(doors)` → `"N,E,S,W"` as `1/0`, e.g. `"1,0,1,0"`. Catalog key: `` `${type}|${sig}` ``.
- `RoomCatalog.pick(doors, type, rng)`: exact `type|sig` match; else `start`/`boss` → any piece of that type passed through `_adaptToDoors` (re-frames with `applyImmutableFrame`, keeps interior `-1` holes); else `challenge` → a `normal` piece with same sig; else `null`.
- `pieceType(piece)`: `start|boss|challenge` kept, anything else → `normal`. **`kind` is ignored for matching.**
- `Room.lockRule`: explicit `customLock` `"buttons"` (needs ≥2 buttons else `"none"`), `"enemies"`, `"none"`; otherwise (incl. `"auto"`/missing) → ≥2 buttons ⇒ `buttons`, else any enemies ⇒ `enemies`, else `none`.

## Data flow
1. `js/main.js`: `new RoomCatalog().load()` during loading screen → `new Game(canvas, {roomCatalog, assets})`.
2. `RoomCatalog.load()`: `fetch("map/index.json", {cache:"no-store"})`; each listed file fetched; `_validate` (only `doors` object + `floor` array); non-enumerable `__file` set; indexed in `bySignature` and `byType`. Failures are `console.warn` and skipped (no throw).
3. `Game.newDungeon()` → `RoomManager.reset()` → `new Dungeon({cols: GRID_COLS, rows: GRID_ROWS, roomCount: ROOM_COUNT, tile, roomCols, roomRows, graph: customGraph||null})` → `new DungeonGraph(opts).generate()`; `runSeed` randomized.
4. `DungeonGraph.generate()`: start at grid center (`type:"start"`), scatter `normal` rooms (`minSpacing=2`, margin 1), farthest from start → `boss`; Prim MST edges; `_carveCorridor` walks Manhattan and adds `kind:"corridor"` cells; `_computeDoors` sets a door wherever a neighbor cell exists.
   - With `GRID_COLS=3`, `gx` is always 1, so every run is the same 5-cell vertical line: `(1,1) room S` · `(1,2) corridor NS` · `(1,3) start NS` · `(1,4) corridor NS` · `(1,5) room N`; one end is `boss` (~50/50). Checked by running `generate()` 2000×.
5. `RoomManager._roomFor(cell)` (lazy, first access) → `_applyAuthoredPiece(cell)`: deterministic `_cellRng(gx, gy)` (seed = gx, gy, floor, runSeed) → `roomCatalog.pick(cell.doors, cell.type||"normal", rng)` → copy piece fields onto `cell.custom*`. If `scatterProps.enabled`, `scatterPropsOnFloor(piece.floor, {density, tiles, occupied: enemy tiles, rng})` replaces `props`.
6. `new Room(cell, dungeon.cellBounds(...))`: `RoomTiles(ROOM_COLS, ROOM_ROWS, doors)`; `tiles.floor = cell.customFloor` or `GlobalRoomVariantCatalog.getFloorForDoors(doors)` (procedural, no content); `tiles.walls`, `wallBoxes` (collision), torches, props.
7. `RoomManager.enter()` → `Room.populate(spawnSystem, floor, assets)` (once): build `ChallengeCorridor` if hazards; seed `heartCount` hearts; set `cleared` from `lockRule`. `Game._activateRoomEnemies()` → `Room.spawnEnemies(frozen)` (via room intro) → `findSafeFloorCell` per authored enemy → `SpawnSystem.createEnemy` → `enemy.setNavigationFloor(floor, bounds, walls)`.
8. Door exit (`Game`, ~L880): only when unlocked, not in playtest, both players aligned (`playerAlignedToDoor`) and `doorEntryDepth` past threshold → fade → `Game.transitionThroughDoor(door)` → `RoomManager.transitionTo(door)` → `Dungeon.moveTo` + `enter()`; players placed by `getPlayerSpawnPositions(oppositeDir)`.
9. Clear: `Game` calls `rooms.tryClearCurrent()` → `Room.tryClear()` (enemies spawned and all dead, or challenge `solved`) → `dungeon.markCurrentCleared()`.

## Schema: room piece (`map/<file>.json`)
Grid coords are tile `col` (0..13) / `row` (0..8), origin top-left, `floor[row][col]`. Validators: **RC** = `RoomCatalog._validate`, **SV** = `serve.py _validate` (save only), **ED** = editor-enforced on authoring, **RT** = runtime behavior.

| Field | Type / values | Req | Validated by / notes |
|---|---|---|---|
| `doors` | `{N,E,S,W: bool}` | yes | RC: object. SV: object + ≥1 truthy door. Drives catalog key. |
| `floor` | `int[9][14]` | yes | RC: array. SV: non-empty list, `floor[0]` is list. RT assumes 14×9 (`ROOM_COLS/ROWS`); no size check anywhere. |
| `id` | string | no | Not unique; editor defaults `room`, `corridor`, `room_start_hub`, `room_boss`. Not used by runtime. |
| `name` | string | no | RT: `customName` → `ChallengeCorridor` name. |
| `cols`,`rows` | int (14, 9) | no | Only `_adaptToDoors` reads them (fallback to floor dims). |
| `kind` | `"room"\|"corridor"` | no | Only affects file name (`serve.py _base_name`). Runtime uses the *cell's* kind. |
| `type` | `"normal"\|"start"\|"boss"\|"challenge"` | no | `pieceType`; unknown → `normal`. Editor exposes normal/start/boss only. |
| `lock` | `"auto"\|"none"\|"enemies"\|"buttons"` | no | RT `Room.lockRule`; `"auto"` or missing = deduce. Editor save writes `"auto"` (see room-editor.md). |
| `holes` | `string[]` `"col,row"` | no | Editor source of truth for `-1`; runtime reads `floor` only. |
| `floorOverrides` | `{ "col,row": int }` | no | Editor-only (EMPTY_FLOOR_TILE `-2` paint); already baked into `floor`. |
| `walls` | `[{col,row,tile,side}]` | no | `tile` ∈ editor list (0,10,20,30,40,1–4,5,15,25,35,45,41–44,50–55); `side` `top\|bottom\|left\|right` (`_wallSideForTile`). RT: drawn, `wallBoxes` collision, enemy nav, not walkable. ED: not on door gaps, holes or spawn tiles. |
| `enemies` | `[{type,col,row}]` | no | `type` key of `ENEMY_TYPE_BY_KEY` (`js/config/EntityConfig.js`; unknown → random melee). ED: interior only, one per tile. RT: relocated by `findSafeFloorCell`; dropped if no safe cell. |
| `hazards` | see below | no | ED: one hazard per tile; only `arrow` on the border. Any hazard ⇒ `Room.isChallengeCorridor`. |
| `torches` | `[{col,row,side,type?}]` | no | `side` `N\|S\|E\|W` (wall torch; E/W sit on col 1 / 12) or `F` with `type` `candlestick_1\|candlestick_2`. RT: `Renderer` + `LightingRenderer` (light pushed inward by side). |
| `props` | `[{col,row,index:int,flip:bool}]` | no | Tileset index. Ignored when scatter enabled. |
| `scatterProps` | `{enabled:bool, density:number, tiles?:int[]}` | no | density UI 0–0.4 (`PROP_SCATTER`), runtime clamps 0–1; candidates are interior tiles equal to 16. |
| `heartCount`, `heartDropChance` | int 0–10 / 0–100 | no | **Not copied by `_applyAuthoredPiece`** → no effect from pieces (see gotchas). |

Hazards (`ChallengeCorridor._build`): `spike {col,row,timing?:"fast"|"normal"|"slow",delay?:sec≥0,phase?,durations?}` · `spikeRow {col,row,dir:"left"|"right"|"up"|"down",count:int≥1,phase:0..1,wave:number,timing?,delay?}` (tiles extend +col or +row from anchor) · `arrow {col,row,side?:"top"|"bottom"|"left"|"right",phase?,dir?}` (side inferred from border if missing; interior = mounted on custom wall) · `button {col,row}`. Legacy `u/v` normalized coords still parsed when `col/row` absent.

Floor cell values: `>=0` tileset index (`Tileset` 10 cols of 16px); frame tiles `0,2,5,20,25,40,42,45` (+ inner trims `11,12,14,21,24,31,32,34`), plain floor `16`, door gap `16`/`17`; `-1` hole/void (fall, drawn via `holeTileFor` autotile); `-2` empty floor (flat `EMPTY_FLOOR_COLOR`, no fall, but `<0` so excluded from safe spawn / walkable checks).

Door openings (2 tiles each, `midC=7`, `midR=4`): N `row0 col6–7`, S `row8 col6–7`, W `col0 row3–4`, E `col13 row3–4`; the inner tile behind each is also floor.

## File naming (`serve.py _base_name` + `_next_filename`)
`type=start` → `room_start_hub`; `type=boss` → `room_boss`; door sig `EW` → `corridor_horizontal_ew`; `NS` → `corridor_vertical_ns`; else `{corridor|room}_{sig}` with sig letters in **N,E,S,W** order lowercased (e.g. `room_nsw`, `corridor_esw`). File = `<base>_<i>.json`, first free `i` from 0. `corredor_ne_01.json` is a hand-named legacy file.

## Spawns
- Players: `getPlayerSpawnPositions(dir)` with `PLAYER_DOOR_SPAWN_TILES`: N (6,1)/(7,1), S (6,7)/(7,7), W (1,3)/(1,4), E (12,3)/(12,4), CENTER (6,4)/(7,4). Entry dir = opposite of the door used. New dungeon uses CENTER (or editor `testSpawn` in playtest + `ensureSafeSpawn`). Fall respawn: entry spot then `ensureSafeSpawn`.
- Enemies: authored only. World pos `bounds.minX + (col-0.5)*TILE` = cell x + `(col+0.5)*TILE`. `isSafeFloorCell` rejects `undefined`, `<0`, and the border ring; ring search by Chebyshev radius, Euclidean tie-break.

## Invariants & gotchas
- Every piece must be listed in `map/index.json` (browser can't list dirs). `corridor_vertical_ns_1.json` currently exists but is **not listed**.
- Catalog key ignores `kind`; a `kind:"corridor"` piece can fill a room cell and vice versa.
- Missing `normal` signature ⇒ procedural `GlobalRoomVariantCatalog` floor with no enemies/hazards (unlocked). No `boss` pieces exist ⇒ the boss cell is always an empty procedural room; `Room.isBoss` is unused.
- Start pieces are reframed to the cell's doors by `_adaptToDoors`; only interior `-1` survives — interior walls/hazards are kept as-is, so content near closed doors may look wrong.
- `Game.floor` is always 1 (never incremented); `getFloor()` only feeds `_cellRng` and enemies.
- `DungeonGraph._generateFromLayout` validation (`heartCount` 0–10, `heartDropChance` 0–100, `enemyCount` 0–20, `boxCount` 0–10, `enemyType` random/demon/blood) is unreachable: nothing passes `layout`.
- Heart drops: `CombatSystem.resolveDeaths` uses `cell.heartDropChance ?? HEART_DROP.chance` (**15**, not 40) and only if `canDropHeart` (total missing lives > hearts on floor).
- `Dungeon` defaults `roomCols=13`; always overridden with `ROOM_COLS=14` by `RoomManager`.
- Changing `ROOM_COLS/ROWS` breaks every piece (no resizing) and `PLAYER_DOOR_SPAWN_TILES` literals.

## How to extend
- New piece: `.agents/playbooks/add-room-piece.md`.
- New room `type`: add to `pieceType`, editor `_allShapes`/`_variantsForShape`, and choose where `DungeonGraph` assigns it.
- Bigger/other layouts: change `GRID_COLS/GRID_ROWS` (generation), or wire `DungeonGraph({layout})` / `ModularGrid.toDungeonGraphData()` into `RoomManager.reset()` as `graph`.
- New piece field: copy it in `RoomManager._applyAuthoredPiece` (and playtest branch in `reset()`), read it in `Room`, emit it in editor `_sceneToData` / `_playtestInGame` / `_importFromData`.

## Tests
`node tests/test_modular_grid.js` (sockets, `ModularGrid`, archetypes; **currently fails** at "Curva SE" assert L281 and aborts — `transformRoomFloor` no longer mirrors CORNER vertically) · `node tests/test_safe_spawn.js` (13 pass) · `node tests/test_player_spawns.js` (20 pass) · `node tests/test_hole_resistance.js` (12 pass, `DungeonTileQuery` falls). `npm run validate:map` (`scripts/validate-map.mjs`) checks every piece against the schema below; `npm test` runs all test files.

## Related docs
`.agents/context/systems/room-editor.md` · `.agents/playbooks/add-room-piece.md` · `.agents/playbooks/add-trap.md` · `.agents/context/systems/combat-and-entities.md` · `.agents/context/architecture.md` · `map/README.md`

### Stairs (2026-10-30)
Editor 2.0 doors may have type stairs: one interior floor cell, rendered with STAIR_INDEX (39). AuthoredDungeon exposes its cell centre and existing connection target/requirement state. RoomManager recognizes both players within STAIR_ENTRY_RADIUS tiles; the usual Game transition handles travel and safeSpawnPair places the pair without immediate re-entry. Stairs have no border opening, corridor stub or door gradient.

Border stairs use the inward adjacent floor for safe arrivals. Their south-edge floor is excluded from the late front-wall redraw so the staircase remains visible.

### Ponto e rota de pouso da serra (2026-10-31)

`DungeonTileQuery.safeDropPoint(x, y, seeds)` preserva coordenadas já alcançáveis e sem buracos na vizinhança 3×3. Caso contrário, busca centro de tile afastado dos buracos, depois piso alcançável. `_dropTests` compartilha esses predicados com `safeDropRoute(x, y, seeds, isBlocked)`.

A rota faz busca em largura nos centros dos tiles, conectados à posição atual por segmentos desobstruídos. Cruza buracos em voo; rejeita paredes, vazio e borda externa. O callback do jogo verifica o volume da serra e os demais sólidos (props, grades e estacas). Prefere piso afastado dos buracos; sem rota até ele, aceita piso alcançável desobstruído. Sem destino retorna lista vazia. SawTackle executa o movimento e novas buscas; Game revalida a chegada com `reachableDropPoint`. Regressões em `test_saw_tackle_landing.js`.
