# Graph Report - dungeon-chained  (2026-10-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 634 nodes · 1242 edges · 28 communities (11 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5fe097dd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- GameConfig.js
- RoomEditor
- Room
- Game
- ModularGrid
- Dungeon
- RoomSocket
- serve.py
- ParticleSystem
- RoomManager
- RoomArchetypes.js
- ParticleEffects
- Renderer
- AssetLoader
- ChallengeCorridor
- BloodStains
- SawWeapon
- BloodCanvas
- AudioManager
- EditorApp.js
- Entity
- MeleeEnemy
- WindSystem
- PostProcessor
- Player
- Tileset
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
- `Enemy` --inherits--> `Entity`  [EXTRACTED]
  js/entities/Enemy.js → js/entities/Entity.js

## Import Cycles
- None detected.

## Communities (28 total, 17 thin omitted)

### Community 0 - "GameConfig.js"
Cohesion: 0.05
Nodes (33): CombatSystem, AUDIO_CLIPS, AUDIO_CONFIG, BACKGROUND_TILE, BLOOD_COLORS, BLOOD_PIXEL, CAM_MARGIN, DOOR_ENTER_DEPTH (+25 more)

### Community 2 - "Room"
Cohesion: 0.06
Nodes (15): PLAYER_DOOR_SPAWN_TILES, ROOM_COLS, ROOM_ROWS, RoomTiles, HeartPickup, Room, GlobalRoomVariantCatalog, spawnCenter (+7 more)

### Community 3 - "Game"
Cohesion: 0.11
Nodes (7): getPlayerSpawnPositions(), Game, bootstrap(), catalogKey(), doorSignature(), pieceType(), RoomCatalog

### Community 5 - "Dungeon"
Cohesion: 0.11
Nodes (3): Dungeon, DIRS, DungeonGraph

### Community 6 - "RoomSocket"
Cohesion: 0.11
Nodes (7): RoomPresets, ALL_DIRECTIONS, DIRECTION, DIRECTION_DELTA, OPPOSITE_DIRECTION, RoomSocket, RoomTemplate

### Community 7 - "serve.py"
Cohesion: 0.12
Nodes (8): _base_name(), _door_sig(), DualStackServer, _load_index(), _next_filename(), RoomServerHandler, _save_index(), _validate()

### Community 8 - "ParticleSystem"
Cohesion: 0.10
Nodes (5): DustPuff, FloorDebris, AIR_BLOOD_COLORS, AirParticle, ParticleSystem

### Community 10 - "RoomArchetypes.js"
Cohesion: 0.15
Nodes (14): adaptStraightOrDeadendAxis(), adaptTJunctionToWest(), applyImmutableFrame(), ARCHETYPE, ARCHETYPE_ORIENTATIONS, CANONICAL_BASE_ORIENTATION, detectShapeFromDoors(), flipInnerHorizontal() (+6 more)

### Community 11 - "ParticleEffects"
Cohesion: 0.14
Nodes (4): BLOOD_STEPS, MAX_FOOTPRINTS, Footprint, ParticleEffects

### Community 16 - "SawWeapon"
Cohesion: 0.16
Nodes (3): LaserWeapon, SawWeapon, Weapon

### Community 19 - "EditorApp.js"
Cohesion: 0.26
Nodes (7): bloodMonsterConfig(), demonConfig(), MELEE_ENEMY_CONFIGS, playerConfigs(), BLOOD_STAIN_CONFIG, PlayerFactory, ENEMY_CONFIG_BY_TYPE

## Knowledge Gaps
- **18 isolated node(s):** `HOLE_TILES`, `PROP_SCATTER`, `ARCHETYPE`, `ARCHETYPE_ORIENTATIONS`, `CANONICAL_BASE_ORIENTATION` (+13 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 209 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RoomEditor` connect `RoomEditor` to `RoomManager`, `EditorApp.js`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **What connects `HOLE_TILES`, `PROP_SCATTER`, `ARCHETYPE` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `GameConfig.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05217391304347826 - nodes in this community are weakly interconnected._
- **Why does `AssetLoader` connect `AssetLoader` to `GameConfig.js`, `RoomEditor`, `EditorApp.js`, `Game`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `RoomEditor` be split into smaller, more focused modules?**
  _Cohesion score 0.10096153846153846 - nodes in this community are weakly interconnected._
- **Why does `RoomManager` connect `RoomManager` to `GameConfig.js`, `Game`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `Room` be split into smaller, more focused modules?**
  _Cohesion score 0.06155632984901278 - nodes in this community are weakly interconnected._