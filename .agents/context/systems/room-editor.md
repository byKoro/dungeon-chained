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
| `js/rooms/HazardLayout.js` | Puro (testado em `tests/test_hazard_layout.js`), usado pelo jogo (`ChallengeCorridor`) e pelo editor 2.0: `arrowFireDir(side, interior)` (parede lateral interna inverte x), `arrowMountOffset` (flecha das paredes leste/oeste deslocada `ARROW_WALL_INSET` = 33px na direção do disparo, para a cabeça do lançador ficar sobre o tijolo; o tile leste/oeste tem tijolo só na metade interna), `spikeRowPhase` (onda: `wave` ausente = `SPIKE_ROW_WAVE` 0.12), `fitSpikeRow` (recua a âncora para a fileira caber), `wallSideForTile`. |
| Armadilhas no editor 2.0 (`ContentTools._applyHazard`) | Flecha: clique em parede monta ali; clique no chão encaixa na borda mais próxima (como o editor 1.0); não monta em porta. Espinhos/fileira só em chão; a fileira grava `dir`, `count`, `phase: 0`, `wave: 0.12` e só entra se todos os tiles forem chão. Clicar em qualquer tile de uma armadilha a remove (fileira inteira); "Remover conteúdo" também. O mapa desenha `peaks2` por tile, seta laranja da onda e o lançador girado/deslocado como no jogo. |
| `js/editor2/ContentCatalog.js` | Puro (testado em `tests/test_editor2_content_catalog.js`). `EDITOR2_ENEMY_KEYS` = inimigos liberados no editor 2.0 (`demon`, `bloodMonster`, `blackKnightB`); **acrescente a chave aqui quando um inimigo ficar pronto**. `thumbRegion(cfg)` = recorte do frame 0 de `walk`. Salas antigas com outros tipos continuam desenhadas e podem ser apagadas; o editor 1.0 usa todos os `ENEMY_TYPES`. |
| `js/editor2/TilePalette.js` | Clickable tileset; drag selects a rectangular stamp. |
| `js/editor2/PropSprites.js` | Loads and animates the prop frames. |
| `js/config/MapEditorConfig.js` | Format id/version, limits, tile kinds, `WALL_TILE_INDICES` (auto kind), `DOOR_TYPES` (`normal`, `boss`; `sprite: null` until the boss gate art exists). |
| `js/config/PropConfig.js` | `ANIMATED_PROPS` (box, mini box, chest, chest opening, coin, flag, flasks 1–4, keys 1–2, flamethrower 1×2 and 2×1: 4 frames each; anvil `assets/anvil/anvil.png`: 1 frame, 2×1 footprint), `PROP_FRAME_MS`. Frames are stretched to the footprint unless the prop has `art: {w, h}` (PNG size in art px): then `PropSprites.draw` draws it at native size (`tilePx/16` per art px) centred on the footprint. The 24×24 anvil uses this so it stays at an integer scale. In the game, `base` makes a prop solid and y-sorted (anvil, chests) and `opens` makes a chest open by proximity (see `combat-and-entities.md` → Scrap and chests). |
| Room events | Panel **Eventos da sala** (ADR 0011): *Desenhar zona* (type the id, click two corners; same id replaces), list with × to remove; *Grade* toggles bar tiles on floor; *Corda arrebenta sozinha* marks the next placed rope as `auto` (red outline). Encounters: id + waves text, one wave per line `tipo:quantidade, …` (`parseWaves`), *Salvar encontro* replaces the same id; the list loads an encounter back into the fields. Interactive *Corda com gaiola* (`rope`) is scripted (a stake whose rope holds a cage above): `DemoProgress` ignores it and any unknown interactive. Chests have **Baú de encontro (id)**: with an id the chest stays hidden until that encounter ends (`prop.encounter`). Data kept by `normalizeRoom` and clipped by resize; helpers in `js/rooms/RoomEventsData.js`. |
| Anvil recipes | Props panel: with Bigorna selected, **Receitas da bigorna** shows one checkbox per `FORGE_RECIPE_IDS` (Serra, Tamanho, Elasticidade, Serra dupla; all checked by default). The placed anvil gets `recipes: [...]`; no field = the default catalog, an empty list = nothing. Eyedrop loads the anvil's list. A map whose anvil offers the Serra starts the run without the saw. Test panel: **Serra no início** (conforme o mapa / com serra / sem serra) → `progress.saw`. |
| Chest scrap | Props panel: when the selected prop has `opens` (Baú, Baú pequeno), the field **Sucata no baú** (`#prop-scrap`, 0..999, default `SCRAP.chestDefault` 10) is shown and the placed prop gets `scrap: N` (`MapModel.placeProp(room, type, c, r, flip, extra)`). To change an existing chest: eyedrop it (loads its value), edit the field, remove and place again. The status bar shows "Baú (N de sucata)". `normalizeRoom` keeps extra prop fields. |

Map file `map/demo/<name>.json` (`format: "dungeon-chained-map"`, `version: 1`): `name`, `grid {cols, rows}`, `roomSize` (default for new rooms), `start` (`"gx,gy"`), `rooms {"gx,gy": room}`. Room: `id, name, notes, cols, rows, tiles[r][c]` (tileset index; `-1` hole; `-2` void), `kinds[r]` (one char per column: `f` floor, `w` wall/collision, `h` hole, `v` void), `doors [{col,row,type,width,id}]` (border tiles, not corners), `props [{type,col,row,flip?}]`. Doors lead where the map's `connections [{from:{room,door}, to:{room,door}, oneWay, requires}]` say (`js/rooms/MapConnections.js`); grid adjacency is only the editor's layout. `requires` (`dash`, `sawThrow`, `bossKey`) keeps the door blocked until that `DemoProgress` flag is set. `validatePlayable` rejects a door without a connection and a boss gate that is not on the north wall with width 2. Saved pretty-printed (`_pretty` in `serve.py` = `formatMapJson`): one tile row per line, `kinds` reads as a drawing of the room.

Tools (keys 1–7): Tile (palette stamp; attribute auto/floor/wall), Buraco, Vazio, Colisão (toggles f↔w, keeps the visual), Porta (type normal/boss; click again removes), Prop, Borracha (frame default, removes door/prop). Right click = eyedropper. Map view: click selects, double click opens/creates, drag moves (drop on a room swaps), links drawn green (ok), orange dashed (no door back), red dashed (no room). Resize room keeps the interior; "Refazer a moldura" rebuilds border + shadow ring and moves doors to the new border.

Persistence: `localStorage["editor2_map_state"]` (autosave, 250 ms debounce); `POST /api/save-map {file, map}` overwrites `map/demo/<file>` (name regex, 5 MB cap, atomic replace); `GET /api/list-maps`. Files in `map/demo/` are not in `map/index.json` and are ignored by `validate:map` and by the game.

Playtest ("Testar sala") only for 14×9 rooms: `toLegacyPiece` → `sessionStorage["editor_custom_room"]` (same contract as the old editor). Interior walls become `walls[]` with floor 16 under them; doors become N/E/S/W booleans, so the game still opens them at the 2 middle tiles; props and door types are not shown in game (warned before testing).

Runtime: the game loads `map/demo/<file>` named by `map/demo/active.json` on a normal boot (`DemoMapLoader`, full `validatePlayable`; any error stops the boot), or the editor's session map with `?editor2=true`. `active.json` points at `inicial.json` (slice 5 of the Início design): room `1,1` "inicial" plus 14×9 placeholder rooms `0,1` "botas" (left door), `2,1` "penhasco" (right door) and `1,0` "boss" (behind the gate, connection `requires: "bossKey"`, which nothing grants yet). A locked boss gate gets a pulsing red light (`DemoDoors.renderLights`, `DEMO.gateHighlight`, `BOSS_GATE_LIGHT`).

## Related docs
`.agents/context/systems/rooms-and-maps.md` · `.agents/playbooks/add-room-piece.md` · `.agents/playbooks/add-trap.md` · ADR `.agents/decisions/0004-authored-room-pieces.md`

### Reset de sala e pincel de Parede (editor 2.0)

- **Resetar sala** (`#btn-reset-room`, card "Sala"): `resetRoom(map, key)` em `js/rooms/MapDocument.js` refaz a moldura padrão (`createRoom`) mantendo tamanho, id, nome e notas. Apaga portas, props, inimigos, armadilhas, tochas, interativos, spawns, trava, tipo, `propDensity` e as conexões de `map.connections` ligadas às portas dessa sala. Dá para desfazer (passa por `_commit`).
- **Parede** (ferramenta 8, `wall`): pincel como "Buraco". O primeiro tile do traço decide o modo (já é parede = apaga, senão pinta). `js/rooms/WallAutotile.js` escolhe o sprite pelo lado do piso (topo 1–4 com piso ao sul ou dos dois lados, base 41–44, esquerda 10/20/30, direita 15/25/35; quinas de contorno fechado: com vazio por dentro (piso por fora) as superiores são 50 (esquerda) e 55 (direita) (`CORNER_TL`/`CORNER_TR`); com piso por dentro são 0 e 5, e as inferiores 40 e 45; as laterais têm meio tile escuro, então parede fina com piso dos dois lados usa o bloco de topo), põe sombra no piso colado na parede (11/14/31/34, 12/13, 32/33, 21, 24) e mantém a variação já sorteada. O pincel também age na moldura (limite da sala): a parede de borda usa a peça do lado (topo 1–4, base 41–44, laterais) e as quinas da sala voltam a 0/5/40/45; só as portas são ignoradas; pintar sobre um tile remove props, inimigos, armadilhas, tochas e interativos dele.
- **Vazio de fora**: ao soltar o mouse de um traço de pintura, `voidOutside` transforma em vazio (`-2`, `v`) o piso e o buraco que não conectam ao tile de piso mais perto do centro, a portas ou a spawns. Se o traço dividir a sala, a parte sem semente vira vazio (Ctrl+Z desfaz).
- Testes: `tests/test_room_reset.js`, `tests/test_wall_autotile.js`. O visual das variações de tile não foi conferido no tileset.

Flame Golem (2026-10-28): flameGolem added to EDITOR2_ENEMY_KEYS; selectable as Golem de Chamas. Classic editor already lists it through ENEMY_TYPES. Placement and existing maps are unchanged.

### Vida infinita no teste (editor 2.0)

Card "Teste e demo": checkbox `#test-infinite-lives` ("Vida infinita (ambos os jogadores)", padrão desligado). `ContentTools.playtest` grava `infiniteLives` na sessão (`sessionStorage[DEMO.sessionKey]`); `DemoMapLoader` devolve em `mapData.test` e `Game` aplica aos dois jogadores (`Game.setInfiniteLives`). Dentro do teste há um botão no canto superior direito e a tecla F7 para ligar/desligar sem reabrir o editor (mostra ON/OFF). O jogo normal e o editor antigo nunca ligam a opção. Detalhes de comportamento em `combat-and-entities.md`.
