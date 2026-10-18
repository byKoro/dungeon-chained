# Graph Report - C:\Users\Usuario\Desktop\dungeon-chained  (2026-10-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1959 nodes · 3636 edges · 98 communities (62 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `806fc272`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- RoomEditor
- mapLayout.js
- ModularGrid
- AssetLoader
- video/package.json
- test_hole_resistance.js
- MeleeEnemy
- FrenzyScene
- ActionArena
- RoomArchetypes.js
- IntroScene
- FrenzyScene.js
- GameConfig.js
- test_safe_spawn.js
- MapGenScene
- AudioManager
- EditorApp.js
- Dungeon
- Scene06_Saw.tsx
- Game
- remotion-best-practices/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx
- remotion-best-practices/remotion-markup/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx
- skills/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx
- skills/remotion-markup/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx
- theme.ts
- gen_fall.py
- remotion-best-practices/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs
- remotion-best-practices/remotion-markup/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs
- skills/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs
- skills/remotion-markup/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs
- IntroScene.js
- SawWeapon
- Root.tsx
- Renderer
- RoomManager
- clamp01
- Scene05_Couch.tsx
- rushKit.js
- TrailerStage
- EntityConfig.js
- template.sh
- sprites_to_gif.py
- remotion-best-practices/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs
- remotion-best-practices/remotion-markup/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs
- skills/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs
- skills/remotion-markup/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs
- ParticleSystem
- PlayerPair.tsx
- PressureButton
- TILE
- ChallengeCorridor
- BloodScreen
- compilerOptions
- remotion-best-practices/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx
- remotion-best-practices/remotion-markup/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx
- skills/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx
- skills/remotion-markup/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx
- serve.py
- PostProcessor
- lerp
- PixelFont.js
- build_tinyrpg_enemies.py
- BloodCanvas
- PlayerAI
- .do_POST
- SawWeapon.js
- export_scene_pngs.py
- export_scene_room.py
- LightingRenderer
- WindSystem
- pil
- RoomTiles
- ParticleSystem.js
- ParticleEffects
- HordeDirector
- SplitShot
- ParticleEffects.js
- ArenaShot
- Tileset
- FlashParticle
- FlameParticle
- GiantSawShot
- GameLoop
- InputHandler
- SparkParticle
- TitleBloodScene
- remotion-best-practices/remotion-maps/techniques/maptiler/assets/MapTilerVectorElement.ts
- remotion-best-practices/remotion-markup/remotion-maps/techniques/maptiler/assets/MapTilerVectorElement.ts
- skills/remotion-maps/techniques/maptiler/assets/MapTilerVectorElement.ts
- skills/remotion-markup/remotion-maps/techniques/maptiler/assets/MapTilerVectorElement.ts
- package.json
- FloorDebris
- hitl-loop.template.sh script
- AirParticle
- block-dangerous-git.sh script

## God Nodes (most connected - your core abstractions)
1. `RoomEditor` - 84 edges
2. `ActionArena` - 42 edges
3. `IntroScene` - 39 edges
4. `clamp01()` - 35 edges
5. `MapGenScene` - 35 edges
6. `FrenzyScene` - 30 edges
7. `SawWeapon` - 29 edges
8. `Game` - 28 edges
9. `lerp()` - 28 edges
10. `Renderer` - 27 edges

## Surprising Connections (you probably didn't know these)
- `renderSpeechBubble()` --indirect_call--> `measureText()`  [INFERRED]
  js/ui/SpeechBubble.js → js/ui/PixelFont.js
- `Scene01Inner()` --calls--> `useShake()`  [EXTRACTED]
  pitch/video/src/scenes/Scene01_Forge.tsx → pitch/video/src/components/useShake.ts
- `Scene03Inner()` --calls--> `useShake()`  [EXTRACTED]
  pitch/video/src/scenes/Scene03_SawBorn.tsx → pitch/video/src/components/useShake.ts
- `Scene06Inner()` --calls--> `useShake()`  [EXTRACTED]
  pitch/video/src/scenes/Scene06_Saw.tsx → pitch/video/src/components/useShake.ts
- `Scene07Inner()` --calls--> `useShake()`  [EXTRACTED]
  pitch/video/src/scenes/Scene07_Chaos1.tsx → pitch/video/src/components/useShake.ts

## Import Cycles
- None detected.

## Communities (98 total, 36 thin omitted)

### Community 1 - "mapLayout.js"
Cohesion: 0.05
Nodes (59): HOLE_TILES, ArrowTrap, SpikeTrap, bakeDungeon(), canvas(), drawSpec(), drawTile16(), silhouette() (+51 more)

### Community 2 - "ModularGrid"
Cohesion: 0.07
Nodes (4): ModularGrid, PlacedRoom, RoomSocket, RoomTemplate

### Community 3 - "AssetLoader"
Cohesion: 0.06
Nodes (7): AssetLoader, bootstrap(), buildTrailerUI(), bootstrap(), TrailerPlayer, LoadingScreen, TIPS

### Community 4 - "video/package.json"
Cohesion: 0.05
Nodes (41): eslint, allowScripts, esbuild, dependencies, react, react-dom, remotion, @remotion/cli (+33 more)

### Community 5 - "test_hole_resistance.js"
Cohesion: 0.08
Nodes (9): Enemy, Entity, Player, DungeonTileQuery, floor, query, rooms, runUntilFall() (+1 more)

### Community 6 - "MeleeEnemy"
Cohesion: 0.07
Nodes (3): MeleeEnemy, BloodStains, GibPiece

### Community 7 - "FrenzyScene"
Cohesion: 0.08
Nodes (7): buildFrenzyBeats(), clamp01(), HORDE, lerp(), smooth(), FrenzyScene, lerp()

### Community 9 - "RoomArchetypes.js"
Cohesion: 0.10
Nodes (18): adaptStraightOrDeadendAxis(), adaptTJunctionToWest(), applyImmutableFrame(), ARCHETYPE, ARCHETYPE_ORIENTATIONS, CANONICAL_BASE_ORIENTATION, detectShapeFromDoors(), flipInnerHorizontal() (+10 more)

### Community 11 - "FrenzyScene.js"
Cohesion: 0.09
Nodes (10): CombatSystem, BLOOD_COLORS, BLOOD_PIXEL, MAX_ACTIVE_GIBS, WIND, Physics, ScreenGore, LensSplatter (+2 more)

### Community 12 - "GameConfig.js"
Cohesion: 0.12
Nodes (23): AUDIO_CLIPS, AUDIO_CONFIG, CAM_MARGIN, CAMERA_DRONE, DOOR_ENTER_DEPTH, GRID_COLS, GRID_ROWS, HIT_SLOWMO (+15 more)

### Community 13 - "test_safe_spawn.js"
Cohesion: 0.06
Nodes (13): Room, findSafeFloorCell(), isSafeFloorCell(), allHoles, bounds, fixed, fixedCell, fixedPos (+5 more)

### Community 14 - "MapGenScene"
Cohesion: 0.12
Nodes (3): backOut(), MapGenScene, whiteFade()

### Community 16 - "EditorApp.js"
Cohesion: 0.10
Nodes (20): EMPTY_FLOOR_COLOR, EMPTY_FLOOR_TILE, getPlayerSpawnPositions(), holeTileFor(), PLAYER_DOOR_SPAWN_TILES, ROOM_COLS, ROOM_ROWS, TORCHES (+12 more)

### Community 17 - "Dungeon"
Cohesion: 0.11
Nodes (3): Dungeon, DIRS, DungeonGraph

### Community 18 - "Scene06_Saw.tsx"
Cohesion: 0.20
Nodes (15): DungeonRoom(), roomTileAt(), BloodBurst(), Flash(), ScreenBlood(), TorchGlow(), Vignette(), OnScreenText() (+7 more)

### Community 20 - "remotion-best-practices/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx"
Cohesion: 0.10
Nodes (22): CountryLabel(), clamp01(), Country, countryPolygons, DRAW, EMPTY, END, lerp() (+14 more)

### Community 21 - "remotion-best-practices/remotion-markup/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx"
Cohesion: 0.10
Nodes (22): CountryLabel(), clamp01(), Country, countryPolygons, DRAW, EMPTY, END, lerp() (+14 more)

### Community 22 - "skills/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx"
Cohesion: 0.10
Nodes (22): CountryLabel(), clamp01(), Country, countryPolygons, DRAW, EMPTY, END, lerp() (+14 more)

### Community 23 - "skills/remotion-markup/remotion-maps/techniques/maptiler/assets/RiverReveal.tsx"
Cohesion: 0.10
Nodes (22): CountryLabel(), clamp01(), Country, countryPolygons, DRAW, EMPTY, END, lerp() (+14 more)

### Community 24 - "theme.ts"
Cohesion: 0.13
Nodes (20): Camera(), Tile(), Prop(), doorCellsFor(), Doors, ROOM_COLS, ROOM_H, ROOM_ROWS (+12 more)

### Community 25 - "gen_fall.py"
Cohesion: 0.14
Nodes (25): add_outline(), build_sheet(), crop_with_feats(), extract_eyes(), fall_pose(), from_grid(), main(), mode_downscale() (+17 more)

### Community 26 - "remotion-best-practices/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs"
Cohesion: 0.08
Nodes (18): ANCHOR_BBOX, biggestPoly(), borders, COUNTRIES, countryMeta, __dir, flowKm, FRAME_BBOX (+10 more)

### Community 27 - "remotion-best-practices/remotion-markup/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs"
Cohesion: 0.08
Nodes (18): ANCHOR_BBOX, biggestPoly(), borders, COUNTRIES, countryMeta, __dir, flowKm, FRAME_BBOX (+10 more)

### Community 28 - "skills/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs"
Cohesion: 0.08
Nodes (18): ANCHOR_BBOX, biggestPoly(), borders, COUNTRIES, countryMeta, __dir, flowKm, FRAME_BBOX (+10 more)

### Community 29 - "skills/remotion-markup/remotion-maps/techniques/maptiler/scripts/prep-geo.mjs"
Cohesion: 0.08
Nodes (18): ANCHOR_BBOX, biggestPoly(), borders, COUNTRIES, countryMeta, __dir, flowKm, FRAME_BBOX (+10 more)

### Community 30 - "IntroScene.js"
Cohesion: 0.13
Nodes (21): BACKGROUND_TILE, DOOR_LIGHT, DOOR_STUB_TILES, LIGHT_PIXEL_SCALE, PLAYER_LIGHT_RADIUS, ACTIVE_BLADE_PROFILE, BUTTON_PROFILE, DOOR_BEAM_PROFILE (+13 more)

### Community 32 - "Root.tsx"
Cohesion: 0.14
Nodes (18): PitchVideo(), SCENE_SECONDS, TOTAL_SECONDS, base, RemotionRoot(), Scene01Forge, Scene02Hela, Scene03SawBorn (+10 more)

### Community 35 - "clamp01"
Cohesion: 0.17
Nodes (7): clamp01(), easeIn(), easeInOut(), hash01(), ArrowWipe, ArrowRunShot, TITLE_TIMING

### Community 36 - "Scene05_Couch.tsx"
Cohesion: 0.16
Nodes (10): ChainSaw(), Point, DungeonBg(), GameName(), cinzel, rajdhani, BULLETS, COLORS (+2 more)

### Community 37 - "rushKit.js"
Cohesion: 0.16
Nodes (11): CRATES, dressProps(), dressRoom(), handheld(), LOOT, RUBBLE, RushShot, mulberry32() (+3 more)

### Community 39 - "EntityConfig.js"
Cohesion: 0.13
Nodes (8): ENEMY_TYPE_BY_KEY, ENEMY_TYPES, MELEE_ENEMY_CONFIGS, playerConfigs(), BLOOD_STAIN_CONFIG, TINY_RPG_ENEMIES, PlayerFactory, SpawnSystem

### Community 40 - "template.sh"
Cohesion: 0.21
Nodes (17): template.sh script, ask(), ask_secret(), banner(), _clear(), finish(), note(), open_url() (+9 more)

### Community 41 - "sprites_to_gif.py"
Cohesion: 0.18
Nodes (19): Image, Path, _canvas_size(), crop_cell(), from_files(), from_sheet(), main(), Salva cada frame como PNG numerado, ampliado (NEAREST), com alfa real. Mantem… (+11 more)

### Community 42 - "remotion-best-practices/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs"
Cohesion: 0.13
Nodes (15): A, AB, B, clip, __dir, even, havKm(), hs (+7 more)

### Community 43 - "remotion-best-practices/remotion-markup/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs"
Cohesion: 0.13
Nodes (15): A, AB, B, clip, __dir, even, havKm(), hs (+7 more)

### Community 44 - "skills/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs"
Cohesion: 0.13
Nodes (15): A, AB, B, clip, __dir, even, havKm(), hs (+7 more)

### Community 45 - "skills/remotion-markup/remotion-maps/techniques/cesium/scripts/prep-cesium-path.mjs"
Cohesion: 0.13
Nodes (15): A, AB, B, clip, __dir, even, havKm(), hs (+7 more)

### Community 47 - "PlayerPair.tsx"
Cohesion: 0.16
Nodes (13): GibExplosion(), animFor(), frameOverrideFor(), PlayerPair(), Pose, Pt, SheetAnim, SpriteSheet() (+5 more)

### Community 49 - "TILE"
Cohesion: 0.18
Nodes (4): HAZARDS, TILE, Arrow, HeartPickup

### Community 52 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, jsx, lib, module, moduleResolution, noEmit (+7 more)

### Community 53 - "remotion-best-practices/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx"
Cohesion: 0.24
Nodes (11): bearing(), CesiumFlythrough(), CesiumFlythroughProps, clamp(), FlyoverMode, havKm(), lerp(), loadCesium() (+3 more)

### Community 54 - "remotion-best-practices/remotion-markup/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx"
Cohesion: 0.24
Nodes (11): bearing(), CesiumFlythrough(), CesiumFlythroughProps, clamp(), FlyoverMode, havKm(), lerp(), loadCesium() (+3 more)

### Community 55 - "skills/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx"
Cohesion: 0.24
Nodes (11): bearing(), CesiumFlythrough(), CesiumFlythroughProps, clamp(), FlyoverMode, havKm(), lerp(), loadCesium() (+3 more)

### Community 56 - "skills/remotion-markup/remotion-maps/techniques/cesium/assets/CesiumFlythrough.tsx"
Cohesion: 0.24
Nodes (11): bearing(), CesiumFlythrough(), CesiumFlythroughProps, clamp(), FlyoverMode, havKm(), lerp(), loadCesium() (+3 more)

### Community 57 - "serve.py"
Cohesion: 0.16
Nodes (13): http_server, json, os, re, _base_name(), _door_sig(), DualStackServer, Servidor de desenvolvimento com cache desativado + salvamento de peças. Uso:… (+5 more)

### Community 59 - "lerp"
Cohesion: 0.20
Nodes (4): lerp(), SnapShot, ZigZagShot, SCENES

### Community 60 - "PixelFont.js"
Cohesion: 0.25
Nodes (12): ACCENTS, COMPOSED, drawText(), GLYPHS, LINE_HEIGHT, measureText(), plot(), resolve() (+4 more)

### Community 61 - "build_tinyrpg_enemies.py"
Cohesion: 0.21
Nodes (14): alpha_count(), attack_ticks(), bbox_union(), build_character(), find_zip_root(), flash_frame(), hit_frame(), load_strip() (+6 more)

### Community 64 - ".do_POST"
Cohesion: 0.24
Nodes (7): _load_index(), _next_filename(), Remove uma peça: apaga map/<file>.json e tira do index.json., Próximo nome livre base_0.json, base_1.json, ... (não sobrescreve)., Validação mínima da peça. Retorna (ok, mensagem)., RoomServerHandler, _validate()

### Community 65 - "SawWeapon.js"
Cohesion: 0.20
Nodes (4): easeOutBack(), easeOutCubic(), SAW_FRAME, Weapon

### Community 66 - "export_scene_pngs.py"
Cohesion: 0.24
Nodes (10): crop_indices(), export(), export_tiled(), Exporta PNGs GRANDES (nearest-neighbor) de peças do cenário a partir do tileset…, Retângulo (left, top, right, bottom) de um tile pelo índice da grade., Recorta um bloco retangular de tiles (lista em ordem de leitura, linha a linha)…, Amplia com NEAREST mantendo pixel art nítido., Repete um único tile numa grade nx*ny (piso contínuo tileável). (+2 more)

### Community 67 - "export_scene_room.py"
Cohesion: 0.21
Nodes (9): build_room(), Exporta a SALA MONTADA em PNGs grandes (nearest-neighbor), replicando o…, Monta a matriz de índices da sala, com abertura dos vãos de porta, exatamente…, Desenha a matriz de índices numa imagem RGBA (1:1 em tiles de 16px)., render(), save(), tile_at(), tile_img() (+1 more)

### Community 70 - "pil"
Cohesion: 0.24
Nodes (8): pil, apply(), find_eye_y(), main(), palette(), Gera variações de expressão (olhos + sobrancelhas) dos jogadores. Lê…, Extrai as cores do próprio personagem a partir do frame original., Gera assets/tileset/_preview.png com cada tile numerado (índice da grade). O…

### Community 71 - "RoomTiles"
Cohesion: 0.27
Nodes (4): RoomTiles, ref_node_fs, DIR, files

### Community 72 - "ParticleSystem.js"
Cohesion: 0.22
Nodes (3): DustPuff, AIR_BLOOD_COLORS, updateAndCompact()

### Community 76 - "ParticleEffects.js"
Cohesion: 0.25
Nodes (3): BLOOD_STEPS, MAX_FOOTPRINTS, Footprint

### Community 79 - "FlashParticle"
Cohesion: 0.29
Nodes (3): FlashParticle, getGlowSprite(), _glowCache

### Community 90 - "package.json"
Cohesion: 0.40
Nodes (4): caveman, dependencies, caveman, type

### Community 92 - "hitl-loop.template.sh script"
Cohesion: 0.83
Nodes (3): hitl-loop.template.sh script, capture(), step()

## Knowledge Gaps
- **284 isolated node(s):** `ARCHETYPE`, `ARCHETYPE_ORIENTATIONS`, `CANONICAL_BASE_ORIENTATION`, `LOWER_BASE_ORIENTATION`, `VERTICAL_ORIENTATIONS` (+279 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RoomEditor` connect `RoomEditor` to `EditorApp.js`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `TILE` connect `TILE` to `mapLayout.js`, `clamp01`, `rushKit.js`, `MeleeEnemy`, `test_hole_resistance.js`, `FrenzyScene.js`, `GameConfig.js`, `EditorApp.js`, `IntroScene.js`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `ActionArena` connect `ActionArena` to `lerp`, `FrenzyScene.js`, `IntroScene.js`, `clamp01`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `ARCHETYPE`, `ARCHETYPE_ORIENTATIONS`, `CANONICAL_BASE_ORIENTATION` to the rest of the system?**
  _284 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RoomEditor` be split into smaller, more focused modules?**
  _Cohesion score 0.07675070028011205 - nodes in this community are weakly interconnected._
- **Should `mapLayout.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05136986301369863 - nodes in this community are weakly interconnected._
- **Should `ModularGrid` be split into smaller, more focused modules?**
  _Cohesion score 0.06708595387840671 - nodes in this community are weakly interconnected._