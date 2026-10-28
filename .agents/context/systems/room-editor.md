# Room editor & dev server

## Purpose
Two editors. This page documents the old piece editor first; the map editor for the demo is in "Editor 2.0" at the end.

Browser tool (`editor.html`) for authoring room pieces (`map/*.json`) on the real 14×9 tile grid, playtesting one piece in the game, and saving/deleting pieces through the dev server `serve.py`. UI text is pt-BR.

## Files
| File | Role |
|---|---|
| `serve.py` | Dev HTTP server (port 8000, no-cache headers, threaded, IPv4+IPv6) + `POST /api/save-room`, `POST /api/delete-room`. |
| `editor.html` | Layout: header (shape name/status, Salvar/Deletar/Testar/Cobertura, link to game), left sidebar of collapsible `.tool-group[data-group]` cards, canvas viewport with overlay nav buttons, two modals. Loads `js/editor/EditorApp.js` as module. |
| `js/editor/EditorApp.js` | Single class `RoomEditor` (~2.4k lines), instantiated on `DOMContentLoaded` as `window.editorApp`. |
| `css/editor.css` | Dark theme, `.tool-group.expanded/.collapsed/.active`, `.shape-arrow-*`, `.variant-bar`, modals, `.status-badge ok/warn`. |
| Reuses | `RoomCatalog`/`doorSignature`, `RoomTiles` (autotile frame), `RoomSocket`, `RoomPresets`, `Tileset`, `AssetLoader`, `GameConfig` (`getPlayerSpawnPositions`, `holeTileFor`, `scatterPropsOnFloor`, `EMPTY_FLOOR_TILE`, `TORCHES`), `ENEMY_TYPES`. |

## How to run
```
python serve.py          # from repo root; prints "Servindo em http://localhost:8000/ ..."
```
Open `http://localhost:8000/editor.html` (game: `http://localhost:8000/`). Any static server can *view* the editor, but Save/Delete require `serve.py`. `npm start` (Electron) does not serve the API.

## Key types & APIs (`RoomEditor`)
- State: `this.room = {id, name, cols, rows, kind, type, sockets:{N,S,E,W: RoomSocket|null}, floor, floorOverrides, holes:Set<"c,r">, hazards, walls, enemies, torches, props, scatterProps, lock}`; `this.activeTab` (= `data-group` of last expanded card) routes canvas clicks.
- Shapes: `_allShapes()` = 17 entries (cross, 4 T, 2 straight, 4 corners, 4 dead-ends, start NESW, boss W). `_variantsForShape(shape)` = catalog pieces with same `doorSignature` and type (`start`/`boss`, else `normal`). Navigation: `_navShape(±1)`, `_navVariant(±1)` (slot `variants.length` = blank "nova variação"), `_newVariant()`, `_loadCurrentShapeVariant()` → `_importFromData(piece)` or `_loadBlankShape(shape)`.
- Floor: `_rebuildAutotile()` regenerates `floor` from `new RoomTiles(cols, rows, doors)`, then applies `floorOverrides`, then `holes` → `-1`. Door sockets are always standard (offset `midC-1`/`midR-1`, span 2).
- Serialization: `_sceneToData()` (save + localStorage), `_playtestInGame()` payload, `_exportJSON()` (download; **not bound to any button**), `_importFromData(data)` (load; `_openImportModal` also unbound).

## Tools (sidebar cards → `activeTab`)
| `data-group` | Click action | Rules enforced |
|---|---|---|
| `tab-holes` (Buracos) | `_toggleHole` (drag paints) | Not on player spawn tiles (`_getPlayerSpawns`), not on walls. `btn-clear-holes`. |
| `tab-floor-tiles` (Tiles de piso) | `_paintEmptyFloorTile` (drag) → `floorOverrides[k] = -2` | Not on walls; removes a hole there. |
| `tab-walls` (Paredes) | `_toggleWallAt` with `#wall-tile` | Same tile again removes; other tile replaces. Border allowed except door gaps (`_isDoorTile`); interior not on spawn tiles or holes. `side` from `_wallSideForTile`. |
| `tab-torches` (Tochas) | `_toggleTorchAt`, radio `torch-choice` | Wall torch: border or col 1/last-1, side deduced, not on door gaps; on custom wall → placed on adjacent tile. Candlesticks: interior, `side:"F"`. |
| `tab-props` (Props) | `_togglePropAt`, radio `prop-choice` | Interior only; disabled when scatter on. `toggle-scatter-props` + `scatter-density` slider (0–40%). |
| `tab-challenges` (Traps) | `_addHazardAt`, radio `hazard-choice` | `button`/`spike`/`spikeRow` interior only; `arrow` snaps to nearest border or a custom wall. One hazard per tile (`_hazardTiles`). Inputs `spike-timing`, `spike-delay`, `spike-row-dir`, `spike-row-count`. `#lock-rule` select (auto/none/enemies/buttons). |
| `tab-enemies` (Inimigos) | `_addEnemyAt` (type from `_buildEnemyChoices`) | Interior, one per tile. `btn-distribute-circle` replaces with 4 demon/bloodMonster. |
| `tab-spawns` (Spawns Players) | `_setCustomTestSpawn` | Sets playtest spawn P1 + free neighbor P2; `#test-spawn-mode` select (CENTER/doors/custom). |

Viewport: zoom buttons, wheel zoom (0.35–3), pan with middle button / Shift / Alt drag, toggles grid/doors/spawns. Cobertura modal (`_renderCoverage`) counts pieces per `normal|sig` for 15 shapes + start/boss.

## Persistence
- `localStorage["editor_scene_state"]` = `_sceneToData()`. Written by `_saveState()`, called from `_updateCodeOutput()` (invoked by nearly every mutation and by `_updateUIFromState`) and before playtest. Restored in `_initAssets` via `_loadSavedState()` (falls back to shape 0 / variant 0).
- `localStorage["editor_test_spawn"]` = `{mode, p1, p2}` (`_loadTestSpawn` / `_saveTestSpawn`).
- `sessionStorage["editor_custom_room"]` = playtest payload (read by the game).

## Playtest
`btn-playtest` → `_playtestInGame()`: builds piece JSON + `testSpawn {p1:{col,row}, p2:{col,row}}`, stores it in sessionStorage, `_saveState()`, navigates to `index.html?playtest=true`. In game, `RoomManager.reset()` sees `?playtest=true` + payload, builds a one-cell graph at grid center (`type: data.type || "start"`, `customFloor`, `customWalls`, `customHazards`, `customEnemies`, `customTorches`, `customProps` (scatter applied), `customLock`, `customName`), and sets `playtestSpawn`. `Game.newDungeon` places players there + `ensureSafeSpawn`. Door transitions are disabled in playtest (`Game` `if (this.playtest) return;`). Back button returns to the editor; state restores from localStorage.

## Server API (`serve.py`)
| Route | Body | Validation | Effect / response |
|---|---|---|---|
| `POST /api/save-room` | piece JSON | `_validate`: dict; `doors` dict with ≥1 truthy of N/E/S/W; `floor` non-empty list with list `floor[0]`. Bad JSON → 400. | Writes `map/<_next_filename(_base_name(piece))>` (compact JSON, UTF-8, never overwrites), appends to `map/index.json` (indent 2). `200 {ok:true, file, count}`; `400 {ok:false, error}`. |
| `POST /api/delete-room` | `{"file": "name.json"}` | regex `^[A-Za-z0-9_\-]+\.json$` (no paths). | Deletes `map/<file>` if present, removes it from index even if missing. `200 {ok, file, count}`; `404` not found; `400` bad name; `500` OS error. |
| other `POST` | — | — | `404 {ok:false, error:"rota não encontrada"}` |
| `GET *` | — | — | Static files from CWD, `Cache-Control: no-store`. |
Route match uses `self.path.rstrip("/")` (query strings are not stripped). No auth: binds `::` (all interfaces, dual stack) so anyone on the LAN can write/delete map files while it runs.

Naming (`_base_name`): start → `room_start_hub`, boss → `room_boss`, sig EW → `corridor_horizontal_ew`, NS → `corridor_vertical_ns`, else `{corridor|room}_{sig in N,E,S,W order}`; suffix `_<first free i>.json`.

## Invariants & gotchas
- `_onMouseDown` must keep `if (e.target !== this.canvas) return;`: mouse events are bound on `#canvas-container`, which also holds the overlay buttons (`shape-prev/next`, `variant-*`).
- Removing an element from `editor.html` requires removing or null-guarding its `getElementById` use. Many `_initEvents` lookups are unguarded (`btn-clear-holes`, `btn-clear-walls`, `btn-clear-hazards`, `btn-clear-enemies`, `btn-distribute-circle`, `toggle-grid`, `toggle-doors`, zoom buttons, modal buttons, `btn-playtest`, `status-coords`) and throw at startup if missing.
- Keep `_saveState` (localStorage) and `_playtestInGame` intact; the playtest payload shape must match `RoomManager.reset()`.
- Save always creates a **new** file. Editing an existing variant then saving duplicates it; delete the old one to "replace".
- `_saveRoomToServer` sends `lock:"auto"` (from `_sceneToData`), while `_exportJSON`/playtest omit `"auto"`. Both are fine at runtime.
- Import rebuilds `floor` from `RoomTiles` + `floorOverrides` + `holes`: any other hand-edited `floor` tile values are lost on re-save; `-1` cells not listed in `holes` disappear.
- `_checkSpawnSafety` targets `#spawn-warning-box` / `#stat-spawns-safety`, which are **not in `editor.html`** → the hazard-on-spawn warning never shows (guarded, no crash).
- Shape list has no `challenge` type; such pieces show under `normal`.
- Variant order follows `map/index.json` order filtered by shape; after save the editor jumps to the last variant.

## How to extend
New tool: add a `<section class="tool-group collapsed" data-group="tab-x">` card, a branch in `_handleCanvasAction`, state on `this.room`, serialize in `_sceneToData`, `_exportJSON`, `_playtestInGame`, read in `_importFromData`, reset in `_loadBlankShape`/`_loadTemplate`/`_createBlankRoom`, render in `render()`, call `_updateCodeOutput()` after mutation. Runtime side: see rooms-and-maps.md "How to extend".

## Tests
No automated editor tests. Manual: run `serve.py`, edit, Testar, Salvar, Cobertura, Deletar; check `map/index.json` diff. Map data checks: `node tests/test_safe_spawn.js`, `npm run validate:map`.

## Editor 2.0 (`editor2.html`) — mapa fixo da demo

Separate tool; the old editor above is untouched. Authors a whole map: a grid of rooms (grid size editable), each room with its own size, every tile editable, tiles picked visually from `assets/tileset/tileset.png`, animated props. Open `http://localhost:8000/editor2.html` (save/list need `serve.py`).

| File | Role |
|---|---|
| `editor2.html` + `css/editor2.css` | Layout; reuses `css/editor.css` (header, sidebar cards, buttons). Sidebar cards carry `data-view="map"` or `"room"`. |
| `js/editor2/MapEditorApp.js` | Class `MapEditorApp` (`window.mapEditor`): two views (map grid / room), tools, undo/redo, autosave, server save/load, import/export, playtest. Keeps the `e.target !== this.canvas` guard in `_onMouseDown`. |
| `js/editor2/MapModel.js` | Pure functions (no DOM), tested by `tests/test_map_model.js`: create/resize rooms and grid, `setCell`/`setKind`/`eraseCell`, doors, props, `roomLinks`, `sequenceOrder`, `validateMap`, `normalizeMap`, `formatMapJson`, `toLegacyPiece`/`legacyIssues`/`findPlaytestSpawn`. |
| `js/editor2/ContentTools.js` | Painel "Conteúdo e gameplay" (montado por JS). Inimigos, tochas e interativos são listas de botões com miniatura (`_buildChoiceList`); clicar escolhe o item **e** ativa a ferramenta (`enemy`/`torch`/`interactive`). Estado em JS: `enemyType`, `torchType`, `interactiveType`, `choice` (armadilha). `sync()` marca `.active` + `aria-pressed` em tudo conforme `app.tool` e preenche `#content-active` ("Ferramenta ativa: …"). |
| `js/editor2/ContentCatalog.js` | Puro (testado em `tests/test_editor2_content_catalog.js`). `EDITOR2_ENEMY_KEYS` = inimigos liberados no editor 2.0 (`demon`, `bloodMonster`, `blackKnightB`); **acrescente a chave aqui quando um inimigo ficar pronto**. `thumbRegion(cfg)` = recorte do frame 0 de `walk`. Salas antigas com outros tipos continuam desenhadas e podem ser apagadas; o editor 1.0 usa todos os `ENEMY_TYPES`. |
| `js/editor2/TilePalette.js` | Clickable tileset; drag selects a rectangular stamp. |
| `js/editor2/PropSprites.js` | Loads and animates the prop frames. |
| `js/config/MapEditorConfig.js` | Format id/version, limits, tile kinds, `WALL_TILE_INDICES` (auto kind), `DOOR_TYPES` (`normal`, `boss`; `sprite: null` until the boss gate art exists). |
| `js/config/PropConfig.js` | `ANIMATED_PROPS` (box, mini box, chest, chest opening, coin, flag, flasks 1–4, keys 1–2, flamethrower 1×2 and 2×1), 4 frames each, `PROP_FRAME_MS`. |

Map file `map/demo/<name>.json` (`format: "dungeon-chained-map"`, `version: 1`): `name`, `grid {cols, rows}`, `roomSize` (default for new rooms), `start` (`"gx,gy"`), `rooms {"gx,gy": room}`. Room: `id, name, notes, cols, rows, tiles[r][c]` (tileset index; `-1` hole; `-2` void), `kinds[r]` (one char per column: `f` floor, `w` wall/collision, `h` hole, `v` void), `doors [{col,row,type}]` (border tiles, not corners; a door on side N of `gx,gy` leads to `gx,gy-1`), `props [{type,col,row,flip?}]`. Saved pretty-printed (`_pretty` in `serve.py` = `formatMapJson`): one tile row per line, `kinds` reads as a drawing of the room.

Tools (keys 1–7): Tile (palette stamp; attribute auto/floor/wall), Buraco, Vazio, Colisão (toggles f↔w, keeps the visual), Porta (type normal/boss; click again removes), Prop, Borracha (frame default, removes door/prop). Right click = eyedropper. Map view: click selects, double click opens/creates, drag moves (drop on a room swaps), links drawn green (ok), orange dashed (no door back), red dashed (no room). Resize room keeps the interior; "Refazer a moldura" rebuilds border + shadow ring and moves doors to the new border.

Persistence: `localStorage["editor2_map_state"]` (autosave, 250 ms debounce); `POST /api/save-map {file, map}` overwrites `map/demo/<file>` (name regex, 5 MB cap, atomic replace); `GET /api/list-maps`. Files in `map/demo/` are not in `map/index.json` and are ignored by `validate:map` and by the game.

Playtest ("Testar sala") only for 14×9 rooms: `toLegacyPiece` → `sessionStorage["editor_custom_room"]` (same contract as the old editor). Interior walls become `walls[]` with floor 16 under them; doors become N/E/S/W booleans, so the game still opens them at the 2 middle tiles; props and door types are not shown in game (warned before testing).

Not done yet (runtime, cronograma #12): the game does not load `map/demo/*.json`; variable room size, per-tile doors, door types and animated props need `Dungeon`, `Room`, `RoomTiles`, `Renderer` and the spawn table to become size-aware.

## Related docs
`.agents/context/systems/rooms-and-maps.md` · `.agents/playbooks/add-room-piece.md` · `.agents/playbooks/add-trap.md` · ADR `.agents/decisions/0004-authored-room-pieces.md`
