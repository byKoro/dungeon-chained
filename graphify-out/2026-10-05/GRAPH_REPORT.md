# Graph Report - dungeon-chained  (2026-10-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 620 nodes · 1218 edges · 21 communities (11 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4106a48d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- RoomEditor
- EditorApp.js
- Game.js
- MeleeEnemy
- ChallengeCorridor
- Game
- ModularGrid
- Dungeon
- serve.py
- ParticleSystem
- Room
- RoomManager
- RoomArchetypes.js
- Renderer
- AssetLoader
- SawWeapon
- ParticleEffects
- BloodCanvas
- WindSystem
- PostProcessor

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
10. `RoomTemplate` - 16 edges

## Surprising Connections (you probably didn't know these)
- `LaserWeapon` --inherits--> `Weapon`  [EXTRACTED]
  js/weapons/LaserWeapon.js → js/weapons/Weapon.js
- `SawWeapon` --inherits--> `Weapon`  [EXTRACTED]
  js/weapons/SawWeapon.js → js/weapons/Weapon.js
- `Enemy` --inherits--> `Entity`  [EXTRACTED]
  js/entities/Enemy.js → js/entities/Entity.js
- `MeleeEnemy` --inherits--> `Entity`  [EXTRACTED]
  js/entities/MeleeEnemy.js → js/entities/Entity.js
- `Player` --inherits--> `Entity`  [EXTRACTED]
  js/entities/Player.js → js/entities/Entity.js

## Import Cycles
- None detected.

## Communities (21 total, 10 thin omitted)

### Community 1 - "EditorApp.js"
Cohesion: 0.05
Nodes (26): bloodMonsterConfig(), demonConfig(), MELEE_ENEMY_CONFIGS, playerConfigs(), BLOOD_STAIN_CONFIG, PLAYER_DOOR_SPAWN_TILES, ROOM_COLS, ROOM_ROWS (+18 more)

### Community 2 - "Game.js"
Cohesion: 0.07
Nodes (30): CombatSystem, AUDIO_CLIPS, BACKGROUND_TILE, BLOOD_COLORS, BLOOD_PIXEL, BLOOD_STEPS, CAM_MARGIN, DOOR_ENTER_DEPTH (+22 more)

### Community 3 - "MeleeEnemy"
Cohesion: 0.05
Nodes (7): Enemy, Entity, MeleeEnemy, Player, BloodStains, GibPiece, SpawnSystem

### Community 4 - "ChallengeCorridor"
Cohesion: 0.08
Nodes (7): HAZARDS, TILE, Arrow, ArrowTrap, PressureButton, SpikeTrap, ChallengeCorridor

### Community 5 - "Game"
Cohesion: 0.11
Nodes (7): getPlayerSpawnPositions(), Game, bootstrap(), catalogKey(), doorSignature(), pieceType(), RoomCatalog

### Community 7 - "Dungeon"
Cohesion: 0.11
Nodes (3): Dungeon, DIRS, DungeonGraph

### Community 8 - "serve.py"
Cohesion: 0.12
Nodes (8): _base_name(), _door_sig(), DualStackServer, _load_index(), _next_filename(), RoomServerHandler, _save_index(), _validate()

### Community 9 - "ParticleSystem"
Cohesion: 0.10
Nodes (5): DustPuff, FloorDebris, AIR_BLOOD_COLORS, AirParticle, ParticleSystem

### Community 10 - "Room"
Cohesion: 0.10
Nodes (4): RoomTiles, HeartPickup, Room, GlobalRoomVariantCatalog

### Community 12 - "RoomArchetypes.js"
Cohesion: 0.15
Nodes (14): adaptStraightOrDeadendAxis(), adaptTJunctionToWest(), applyImmutableFrame(), ARCHETYPE, ARCHETYPE_ORIENTATIONS, CANONICAL_BASE_ORIENTATION, detectShapeFromDoors(), flipInnerHorizontal() (+6 more)

### Community 15 - "SawWeapon"
Cohesion: 0.16
Nodes (3): LaserWeapon, SawWeapon, Weapon

## Knowledge Gaps
- **18 isolated node(s):** `ENEMY_CONFIG_BY_TYPE`, `DIR`, `files`, `spawnCenter`, `spawnE` (+13 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 204 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RoomEditor` connect `RoomEditor` to `EditorApp.js`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **What connects `ENEMY_CONFIG_BY_TYPE`, `DIR`, `files` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RoomEditor` be split into smaller, more focused modules?**
  _Cohesion score 0.09678878335594754 - nodes in this community are weakly interconnected._
- **Why does `AssetLoader` connect `AssetLoader` to `RoomEditor`, `EditorApp.js`, `Game.js`, `Game`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Should `EditorApp.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05109126984126984 - nodes in this community are weakly interconnected._
- **Why does `RoomManager` connect `RoomManager` to `Game.js`, `Game`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Game.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06568832983927324 - nodes in this community are weakly interconnected._