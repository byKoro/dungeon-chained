# Project: Dungeon Chained Architectural Decoupling & Replatforming

## Architecture

### Hexagonal Architecture (Ports & Adapters)
The game is partitioned into two distinct layers:
1. **Pure Game Simulation (`js/sim/`)**: Engine-agnostic domain logic, pure 60 Hz mathematics, entity states, cable/saw dynamics, combat resolution, and dungeon generation. Contains ZERO dependencies on DOM, Canvas 2D contexts, `window`, `document`, Web Audio, or browser globals. Directly portable 1:1 to Unity C# (`DungeonChained.Core`).
2. **Platform View & I/O Adapters (`js/adapters/`, `js/core/`, `js/ui/`)**: Platform-specific implementations of abstract ports:
   - **Input Port (`IInputProvider`)**: Consumed by simulation as `InputSnapshot`. Implemented for Web by `WebInputAdapter` (DOM keys + Gamepad API) and for Unity by `UnityInputAdapter`.
   - **Event Port (`ISimulationEvents`)**: Output event queue emitted by simulation at each step. Consumed by `AudioEventAdapter` (Web Audio / `AudioManager`) and `JuiceEventAdapter` (camera shake, screen gore, particle bursts).
   - **View Port (`ISimulationSnapshot`)**: Read-only simulation state consumed by `CanvasViewRenderer` (Web 2D Canvas) and for Unity by `UnityViewRenderer` (MonoBehaviours / 2D URP).

```
                      +---------------------------------------+
                      |       PURE SIMULATION CORE (js/sim)   |
                      |  - PlayerModel, TetherModel, SawModel |
                      |  - EnemyModel, CombatSim, DungeonSim  |
                      |  - Fixed 60Hz Step, Vector Math       |
                      +-------------------+-------------------+
                                          |
                  +-----------------------+-----------------------+
                  |                                               |
                  v                                               v
         [ IInputProvider ]                            [ ISimulationEvents ]
                  ^                                               |
                  |                                               |
     +------------+------------+                     +------------+------------+
     |  Platform Input Adapter |                     |  Platform Audio / Juice |
     |  - Web: WebInputAdapter |                     |  - Web: AudioManager    |
     |  - Unity: Input System  |                     |  - Unity: AudioSource   |
     +-------------------------+                     +-------------------------+
                                          |
                                          v
                             [ ISimulationSnapshot / View ]
                                          |
                             +------------+------------+
                             |  Platform Render Adapter|
                             |  - Web: CanvasView      |
                             |  - Unity: 2D URP View   |
                             +-------------------------+
```

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Git Branch Isolation | Create dedicated feature branch off main, preserve uncommitted 2026-10-30 work, keep main pristine | M1 | Survey 3 / R1 |
| 2 | Architecture Proposal Document | Comprehensive specification of boundaries, domain models, and migration plan | M1 | Survey 1-3 / R2 |
| 3 | Asset & Map Sanity Baseline | Register corridor_vertical_ns_1.json, eliminate tileset 404 network spam in AssetLoader | M1 | Survey 3 / R4 |
| 4 | Pure Vector Math & Geometry | Pure math primitives (Vec2, Rect2D, PhysicsSim) in js/sim/math/ | M2 | Survey 1 / R3 |
| 5 | Player Domain Model | Pure player state, velocity, dash, hole fall, and lives in PlayerModel.js | M2 | Survey 1 / R3 |
| 6 | Tether & Cable Dynamics | Pure spring constraints, strain, snap, and reconnection in TetherModel.js | M2 | Survey 1 / R3 |
| 7 | Saw Weapon Dynamics | Pure spin, drag, inertia, dropped push, and hit radius in SawModel.js | M2 | Survey 1 / R3 |
| 8 | Combat & Damage Simulation | Pure hitbox overlaps, poise, damage calculations, and hit-stop in CombatSim.js | M2 | Survey 1 / R3 |
| 9 | Enemy AI & Boss State Machines | Pure state machines for Melee, Golem, Ghostfire, Cultist, and traps in EnemyModel.js | M2 | Survey 1 / R3 |
| 10 | Dungeon Simulation & Collision | Pure grid, wall bounds, safe drop points, and spatial query in DungeonSim.js | M2 | Survey 1 / R3 |
| 11 | Simulation Event Queue | Pure event buffer (HitEvent, SnapEvent, FootstepEvent, ShakeEvent) in SimulationEvents.js | M2 | Survey 1 / R3 |
| 12 | GameSimulation Loop | Deterministic fixed 60Hz step orchestrator in GameSimulation.js | M2 | Survey 1 / R3 |
| 13 | Input Port & Web Input Adapter | InputSnapshot interface and WebInputAdapter consuming DOM/Gamepad | M3 | Survey 2 / R3 |
| 14 | Event Dispatch Adapter | Web audio & juice adapter consuming SimulationEvents (audio cues, shake, particles) | M3 | Survey 2 / R3 |
| 15 | Canvas 2D View Adapter | Decoupled CanvasViewRenderer rendering simulation snapshot with preserved depth sorting | M3 | Survey 2 / R3 |
| 16 | Game.js Platform Integration | Game.js adapted to orchestrate GameSimulation through adapters | M3 | Survey 2 / R3, R5 |
| 17 | Static Room UnstainableRects Cache | Cache static floor/hole rects on Room object to eliminate per-frame GC churn | M4 | Survey 3 / R4 |
| 18 | RenderView Double Filter Elimination | Single-pass sorted drawable loop in Game._renderView | M4 | Survey 3 / R4 |
| 19 | Saw Position Allocation Elimination | Scalar cache / object reuse for getSawPositions across physics and collision | M4 | Survey 3 / R4 |
| 20 | Collision Broadphase AABB Optimization | AABB early-out in Physics.resolveBoxCollisions to skip hypot on distant tiles | M4 | Survey 3 / R4 |
| 21 | Chain Obstacle Allocation Optimization | Inline point testing in ChainObstacleSystem._findContact | M4 | Survey 3 / R4 |
| 22 | Dead Function & Code Removal | Delete 7 dead methods, unused configs, and 4 unused imports | M4 | Survey 3 / R4 |
| 23 | Automated Test Suite Verification | Verify 44/45 tests pass with 0 regressions across all refactored systems | M5 | Survey 3 / R5 |
| 24 | Map Validation Gate | Verify npm run validate:map passes with 0 errors | M5 | Survey 3 / R5 |
| 25 | Full Definition-of-Done Gate | Verify npm run check and runtime browser playability | M5 | Survey 3 / R5 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Git Branch Isolation & Architecture Proposal | Branch `feat/unity-port-replatform`, commit baseline, create `ARCHITECTURE_PROPOSAL.md`, fix tileset 404 & map index | none | IN_PROGRESS |
| M2 | Engine-Agnostic Simulation Core | Create `js/sim/` (math, models, combat, enemy AI, dungeon, events, GameSimulation) with zero DOM/Canvas dependencies | M1 | PLANNED |
| M3 | Ports & Adapters Web Integration | Implement `WebInputAdapter`, `CanvasViewRenderer`, `AudioEventAdapter`, and adapt `Game.js` | M2 | PLANNED |
| M4 | Performance Optimization & Dead Code Removal | Cache `unstainableRects`, optimize `_renderView`, AABB broadphase, eliminate 7 dead methods & unused imports | M3 | PLANNED |
| M5 | Regression Gate & Final Verification | Run `npm test`, `npm run validate:map`, `npm run check`, verify clean git status and runtime playability | M4 | PLANNED |

---

## Interface Contracts

### 1. Input Adapter (`WebInputAdapter` -> `GameSimulation`)
- **Signature**: `getInputSnapshot(): InputSnapshot`
- **Data Structure**:
  ```javascript
  {
    players: [
      { moveX: number, moveY: number, dash: boolean, interact: boolean },
      { moveX: number, moveY: number, dash: boolean, interact: boolean }
    ],
    menu: { up: down: boolean, left: boolean, right: boolean, confirm: boolean, cancel: boolean, pause: boolean },
    dt: number
  }
  ```

### 2. Simulation Step (`GameSimulation`)
- **Signature**: `step(inputSnapshot): SimulationEvents`
- **Behavior**: Pure 60Hz deterministic tick. Updates player models, chain constraint, saw physics, combat collisions, enemy AI, and dungeon room logic. Returns an array of event descriptors.

### 3. Simulation Events (`GameSimulation` -> `AudioEventAdapter` & `JuiceEventAdapter`)
- **Event Types**:
  - `SawSnapped`: `{ x, y }`
  - `SawReconnected`: `{}`
  - `SawHit`: `{ x, y, hitCount, heavy }`
  - `EntityDamaged`: `{ entityId, x, y, damage, isPlayer, remainingLives }`
  - `EntityDied`: `{ entityId, x, y, enemyType }`
  - `PlayerFootstep`: `{ playerIndex, x, y, inBlood }`
  - `PlayerFell`: `{ playerIndex, x, y }`
  - `PlayerDashed`: `{ playerIndex, dirX, dirY }`
  - `CameraShake`: `{ intensity }`

### 4. View Snapshot (`GameSimulation` -> `CanvasViewRenderer`)
- **Signature**: `getRenderSnapshot(): RenderSnapshot`
- **Data Structure**:
  ```javascript
  {
    room: { cellRect, tiles, doors, bounds },
    players: [ { x, y, rotation, facingLeft, animState, animFrame, invulnerable, isFalling, fallProgress, lives, maxLives, feetSortY } ],
    chain: { connected, points: [{x, y}], strain, hasSaw },
    saw: { x, y, rotation, spin, dropped, radius },
    enemies: [ { id, type, x, y, facingLeft, animState, animFrame, hp, maxHp, feetSortY } ],
    pickups: [ { type, x, y, collected } ],
    traps: [ { type, x, y, state, timer } ]
  }
  ```

---

## Code Layout

### Greenfield Simulation Modules (`js/sim/`)
- `js/sim/math/Vec2.js`: 2D vector mathematics (pure).
- `js/sim/math/Rect2D.js`: 2D axis-aligned bounding box (pure).
- `js/sim/math/PhysicsSim.js`: Pure mathematical constraint & collision solver.
- `js/sim/models/PlayerModel.js`: Pure player simulation (movement, dash, lives, hole fall).
- `js/sim/models/TetherModel.js`: Pure tether/chain spring dynamics, strain, snap.
- `js/sim/models/SawModel.js`: Pure saw spin, physics drag, inertia, dropped state.
- `js/sim/models/EnemyModel.js`: Pure enemy AI state machines (Melee, Golem, Boss, traps).
- `js/sim/models/CombatSim.js`: Pure hit detection, damage, poise break.
- `js/sim/models/DungeonSim.js`: Pure tile query, wall collisions, room bounds.
- `js/sim/events/SimulationEvents.js`: Lightweight typed event buffer.
- `js/sim/GameSimulation.js`: Fixed 60Hz step simulation orchestrator.

### Platform Adapters (`js/adapters/`)
- `js/adapters/WebInputAdapter.js`: Translates DOM events & Gamepad API to `InputSnapshot`.
- `js/adapters/CanvasViewRenderer.js`: Renders `RenderSnapshot` onto HTML Canvas 2D.
- `js/adapters/AudioEventAdapter.js`: Maps `SimulationEvents` to `AudioManager` audio cues.
- `js/adapters/JuiceEventAdapter.js`: Maps `SimulationEvents` to camera shake and particles.

### Preserved Existing Modules
- `js/Game.js`: Thin application shell coordinating adapters and `GameSimulation`.
- `js/core/Renderer.js`: Canvas 2D context manager, camera transforms, lighting.
- `js/core/AudioManager.js`: Web Audio graph and SFX pool.
- `js/core/AssetLoader.js`: Image and audio asset loader.
- `js/ui/*`: Screen menus, HUD, and overlays.
- `js/editor/*`: Room and map editors.
