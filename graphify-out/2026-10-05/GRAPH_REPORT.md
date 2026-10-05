# Graph Report - dungeon-chained  (2026-10-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 615 nodes · 1213 edges · 33 communities (16 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4106a48d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- RoomEditor
- ModularGrid
- Game
- Dungeon
- RoomSocket
- ParticleSystem
- RoomManager
- Room
- RoomArchetypes.js
- Game.js
- serve.py
- ChallengeCorridor
- ParticleEffects
- Renderer
- AssetLoader
- BloodStains
- SawWeapon
- Physics
- ChallengeCorridor.js
- BloodCanvas
- EditorApp.js
- Entity
- RoomManager.js
- MeleeEnemy
- WindSystem
- test_player_spawns.js
- PostProcessor
- Player
- Tileset
- AudioManager
- InputHandler
- SpawnSystem

## God Nodes (most connected - your core abstractions)
1. `RoomEditor` - 67 edges
2. `RoomManager` - 26 edges
3. `AssetLoader` - 22 edges
4. `Game` - 22 edges
5. `ModularGrid` - 21 edges
6. `Renderer` - 20 edges
7. `Dungeon` - 20 edges
8. `RoomSocket` - 18 edges
9. `PlacedRoom` - 17 edges
10. `BloodCanvas` - 16 edges

## Surprising Connections (you probably didn't know these)
- `MeleeEnemy` --inherits--> `Entity`  [EXTRACTED]
  js/entities/MeleeEnemy.js → js/entities/Entity.js
- `Player` --inherits--> `Entity`  [EXTRACTED]
  js/entities/Player.js → js/entities/Entity.js
- `LaserWeapon` --inherits--> `Weapon`  [EXTRACTED]
  js/weapons/LaserWeapon.js → js/weapons/Weapon.js
- `SawWeapon` --inherits--> `Weapon`  [EXTRACTED]
  js/weapons/SawWeapon.js → js/weapons/Weapon.js
- `bootstrap()` --calls--> `Game`  [EXTRACTED]
  js/main.js → js/Game.js

## Import Cycles
- None detected.

## Communities (33 total, 17 thin omitted)

### Community 2 - "Game"
Cohesion: 0.12
Nodes (6): getPlayerSpawnPositions(), Game, bootstrap(), catalogKey(), pieceType(), RoomCatalog

### Community 3 - "Dungeon"
Cohesion: 0.11
Nodes (3): Dungeon, DIRS, DungeonGraph

### Community 4 - "RoomSocket"
Cohesion: 0.11
Nodes (7): RoomPresets, ALL_DIRECTIONS, DIRECTION, DIRECTION_DELTA, OPPOSITE_DIRECTION, RoomSocket, RoomTemplate

### Community 5 - "ParticleSystem"
Cohesion: 0.10
Nodes (5): DustPuff, FloorDebris, AIR_BLOOD_COLORS, AirParticle, ParticleSystem

### Community 7 - "Room"
Cohesion: 0.10
Nodes (4): RoomTiles, HeartPickup, Room, GlobalRoomVariantCatalog

### Community 8 - "RoomArchetypes.js"
Cohesion: 0.14
Nodes (14): adaptStraightOrDeadendAxis(), adaptTJunctionToWest(), applyImmutableFrame(), ARCHETYPE, ARCHETYPE_ORIENTATIONS, CANONICAL_BASE_ORIENTATION, detectShapeFromDoors(), flipInnerHorizontal() (+6 more)

### Community 9 - "Game.js"
Cohesion: 0.16
Nodes (19): AUDIO_CLIPS, BACKGROUND_TILE, BLOOD_COLORS, BLOOD_PIXEL, CAM_MARGIN, DOOR_ENTER_DEPTH, DOOR_STUB_TILES, HOLE_TILE (+11 more)

### Community 10 - "serve.py"
Cohesion: 0.15
Nodes (7): _base_name(), _door_sig(), _load_index(), _next_filename(), RoomServerHandler, _save_index(), _validate()

### Community 11 - "ChallengeCorridor"
Cohesion: 0.12
Nodes (3): PressureButton, SpikeTrap, ChallengeCorridor

### Community 12 - "ParticleEffects"
Cohesion: 0.14
Nodes (4): BLOOD_STEPS, MAX_FOOTPRINTS, Footprint, ParticleEffects

### Community 16 - "SawWeapon"
Cohesion: 0.16
Nodes (3): LaserWeapon, SawWeapon, Weapon

### Community 17 - "Physics"
Cohesion: 0.16
Nodes (4): CombatSystem, MAX_ACTIVE_GIBS, PLAYER_SAFE_ZONE, Physics

### Community 18 - "ChallengeCorridor.js"
Cohesion: 0.20
Nodes (4): HAZARDS, TILE, Arrow, ArrowTrap

### Community 20 - "EditorApp.js"
Cohesion: 0.26
Nodes (7): bloodMonsterConfig(), demonConfig(), MELEE_ENEMY_CONFIGS, playerConfigs(), BLOOD_STAIN_CONFIG, PlayerFactory, ENEMY_CONFIG_BY_TYPE

### Community 22 - "RoomManager.js"
Cohesion: 0.20
Nodes (7): GRID_COLS, GRID_ROWS, ROOM_COLS, ROOM_COUNT, ROOM_ROWS, DIR, files

### Community 25 - "test_player_spawns.js"
Cohesion: 0.22
Nodes (7): PLAYER_DOOR_SPAWN_TILES, spawnCenter, spawnE, spawnN, spawnS, spawnW, spawnWorld

## Knowledge Gaps
- **18 isolated node(s):** `ENEMY_CONFIG_BY_TYPE`, `DIR`, `files`, `spawnCenter`, `spawnE` (+13 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 200 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RoomEditor` connect `RoomEditor` to `EditorApp.js`, `RoomManager`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **What connects `ENEMY_CONFIG_BY_TYPE`, `DIR`, `files` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RoomEditor` be split into smaller, more focused modules?**
  _Cohesion score 0.0993006993006993 - nodes in this community are weakly interconnected._
- **Why does `AssetLoader` connect `AssetLoader` to `RoomEditor`, `Game.js`, `Game`, `EditorApp.js`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Should `ModularGrid` be split into smaller, more focused modules?**
  _Cohesion score 0.1092436974789916 - nodes in this community are weakly interconnected._
- **Why does `RoomManager` connect `RoomManager` to `Game.js`, `Game`, `RoomManager.js`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `Game` be split into smaller, more focused modules?**
  _Cohesion score 0.11586452762923351 - nodes in this community are weakly interconnected._