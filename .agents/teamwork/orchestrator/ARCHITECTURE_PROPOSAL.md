# Architectural Design Proposal: Dungeon Chained Modular Decoupling & Unity Port Architecture

## Executive Summary
This document establishes the formal architectural design proposal for refactoring *Dungeon Chained* into an engine-agnostic core simulation coupled to pluggable presentation adapters (Hexagonal / Ports & Adapters Architecture). The primary objectives are:
1. **Engine-Agnostic Core Simulation**: Isolate all game mathematics, player movement, dual-player tether/saw physics, combat resolution, entity AI state machines, and dungeon room generation into a pure JavaScript module layer (`js/sim/`) completely free of DOM, Canvas 2D contexts, `window`, `document`, Web Audio, or browser globals. This core layer maps 1:1 to a standalone C# library (`DungeonChained.Core`) for a future Unity port.
2. **Pluggable Platform Adapters**: Adapt the existing Web Canvas 2D renderer, Web Audio pipeline, and DOM/Gamepad input handlers to consume the simulation state and event streams through strictly typed interface contracts (`IInputProvider`, `ISimulationEvents`, `ISimulationSnapshot`), keeping the current JavaScript game fully playable.
3. **Performance & Code Hygiene**: Optimize hot-path loops (eliminating redundant per-frame heap allocations, introducing AABB early-outs, and caching static room geometry) and eliminate verified dead functions and obsolete configs.
4. **Zero-Regression Phased Execution**: Execute through five verifiable milestones with automated tests (`npm test`, `npm run check`) acting as continuous regression gates.

---

## 1. Domain Boundary & Subsystem Responsibilities

### 1.1 Pure Game Simulation Layer (`js/sim/`)
The simulation layer operates as a closed, deterministic, fixed-timestep (60 Hz / 16.667 ms) state machine. It contains zero references to visual rendering or platform audio.

- **Math & Physics Primitives (`js/sim/math/`)**:
  - `Vec2`: 2D vector data structure supporting vector addition, subtraction, scalar scaling, magnitude, normalization, and dot products.
  - `Rect2D`: Axis-aligned bounding box data structure for tile and hazard bounds.
  - `PhysicsSim`: Static mathematical solvers for Verlet/Euler cable spring constraints, distance-to-segment calculations, circle-circle collision resolution, circle-box collision resolution with AABB early-out, and obstacle boundary deflections.
- **Player Simulation (`js/sim/models/PlayerModel.js`)**:
  - Encapsulates player position, velocity, hit radius, facing direction, lives, invulnerability timers, hurt/scared animation states, dash state machine (active, duration, cooldown, direction), and hole falling physics.
  - Operates purely on input vectors and room collision queries.
- **Tether Dynamics (`js/sim/models/TetherModel.js`)**:
  - Solves the elastic cable constraint between Player 1 and Player 2. Computes distance, strain accumulation (0..30 steps), snapping threshold (break distance > 240 px), and reconnection proximity (< 110 px).
- **Saw Dynamics (`js/sim/models/SawModel.js`)**:
  - Simulates saw rotation, spin speed (0..1), physical cable sag/drag, inertia when dropped, velocity damping, and dropped saw pushback mechanics.
- **Combat & Damage (`js/sim/models/CombatSim.js`)**:
  - Evaluates circle-circle and circle-capsule hitbox intersections between saw/players and enemies. Computes damage, poise degradation, knockback vectors, and hit-stop frames.
- **Entity AI & Bosses (`js/sim/models/EnemyModel.js`)**:
  - Manages discrete finite state machines (`Chase`, `Windup`, `Attack`, `Recover`, `Hurt`, `Stunned`, `Dying`, `Dead`) for Melee, Cultist, Flame Golem Boss, and Ghostfire Boss. Evaluates tile-based pathfinding queries and attack cooldown timers.
- **Dungeon Simulation (`js/sim/models/DungeonSim.js`)**:
  - Stores the active room layout, floor matrices, hole borders, wall bounding boxes, door portals, and safe spawn/drop locations.
- **Event Queue (`js/sim/events/SimulationEvents.js`)**:
  - Append-only buffer populated during a simulation step. Captures all audio cues, particle spawn locations, camera shake requests, and gameplay milestones to be dispatched to external adapters.

### 1.2 Platform Adapters Layer (`js/adapters/`, `js/core/`)
The platform layer bridges the pure simulation to browser technologies and user hardware:

- **Web Input Adapter (`js/adapters/WebInputAdapter.js`)**:
  - Listens to DOM `"keydown"` / `"keyup"` events and polls `navigator.getGamepads()`.
  - Normalizes digital and analog directional vectors (deadzone 0.35) and debounces edge-triggered buttons (dash, interact) into an immutable `InputSnapshot` consumed by `GameSimulation`.
- **Canvas 2D View Adapter (`js/adapters/CanvasViewRenderer.js`)**:
  - Receives `ISimulationSnapshot` (read-only projection of entity coordinates, states, rotations, and cable points).
  - Retrieves sprite sheets from `AssetLoader`, computes sprite animation frame crops, generates drop shadows, depth-sorts drawables by `feetSortY`, and executes Canvas 2D transforms and drawing commands.
  - Maintains pixel-art crispness (`imageSmoothingEnabled = false`) and integer zoom quantization.
- **Audio & Juice Adapters (`js/adapters/AudioEventAdapter.js`, `js/adapters/JuiceEventAdapter.js`)**:
  - Flushes `SimulationEvents` emitted by the simulation.
  - Maps domain events (`SawSnapped`, `SawHit`, `EntityDamaged`, `PlayerFootstep`) to `AudioManager.play()`, dynamic bus ducking (`AudioManager.duck()`), camera shake (`Renderer.triggerShake()`), and screen gore flash (`ScreenGore.triggerFlash()`).

---

## 2. Unity Port Architecture Mapping (`DungeonChained.Core`)

Every module in `js/sim/` has a direct, seamless 1:1 translation to a pure C# class library (`.NET Standard 2.1`) without any dependency on `UnityEngine`:

| JavaScript Simulation Module (`js/sim/`) | Unity C# Architecture Equivalent | Unity Engine Responsibility |
|------------------------------------------|-----------------------------------|-----------------------------|
| `Vec2.js`, `Rect2D.js` | `struct Vec2`, `struct Rect2D` | Pure C# value types; no `UnityEngine.Vector2` dependency |
| `PhysicsSim.js` | `static class PhysicsSim` | Custom deterministic math; bypasses Unity PhysX overhead |
| `PlayerModel.js` | `class PlayerModel` | Simulated in C# `FixedUpdate()`; view mirrored by `PlayerView : MonoBehaviour` |
| `TetherModel.js`, `SawModel.js` | `class TetherModel`, `class SawModel` | Cable rendered by Unity `LineRenderer` / TrailRenderer |
| `CombatSim.js` | `class CombatSim` | Pure numeric hit detection; triggers Cinemachine Impulse & Wwise/AudioSource |
| `EnemyModel.js` | `class EnemyModel` | AI FSM ticked at 60 Hz; view controller drives Unity `Animator` states |
| `DungeonSim.js` | `class DungeonSim` | Tile indices mapped to Unity `Tilemap` / 2D Colliders |
| `SimulationEvents.js` | `struct SimulationEventBuffer` | C# struct event queue processed at the end of `FixedUpdate()` |
| `GameSimulation.js` | `class GameSimulation` | Master simulation container hosted inside a Unity `GameManager : MonoBehaviour` |

---

## 3. Phased Execution Plan

The refactoring is executed across five distinct, verifiable milestones:

### Milestone 1: Git Branch Isolation & Baseline Sanity
- **Actions**:
  - Establish dedicated feature branch `feat/unity-port-replatform` off `main`, preserving `main` untouched.
  - Commit baseline working tree cleanly.
  - Place `ARCHITECTURE_PROPOSAL.md` in repository.
  - Register `corridor_vertical_ns_1.json` in `map/index.json` (resolving pre-existing map validation Bug #4).
  - Eliminate non-existent `tileset_2..6.png` requests in `AssetLoader.js` (stopping 404 network spam).
- **Verification Gate**:
  - `git branch` confirms work on `feat/unity-port-replatform`.
  - `npm test` passes 44/45 tests.
  - `npm run validate:map` passes with 0 errors.

### Milestone 2: Engine-Agnostic Simulation Core (`js/sim/`)
- **Actions**:
  - Construct pure math modules: `Vec2.js`, `Rect2D.js`, `PhysicsSim.js`.
  - Construct domain models: `PlayerModel.js`, `TetherModel.js`, `SawModel.js`, `EnemyModel.js`, `CombatSim.js`, `DungeonSim.js`.
  - Construct event buffer: `SimulationEvents.js`.
  - Construct deterministic simulation coordinator: `GameSimulation.js`.
  - Remove all DOM `document.createElement('canvas')` calls from simulation entities (`Player`, `MeleeEnemy`, `SawWeapon`, `HeartPickup`).
- **Verification Gate**:
  - Run Node syntax check and unit test suite against `js/sim/` modules. Zero browser global accesses (`window`, `document`, `navigator`).

### Milestone 3: Ports & Adapters Web Integration
- **Actions**:
  - Implement `WebInputAdapter.js` translating DOM / Gamepad events into `InputSnapshot`.
  - Implement `CanvasViewRenderer.js` consuming `RenderSnapshot` and rendering sprites, cable, shadows, and occluders.
  - Implement `AudioEventAdapter.js` and `JuiceEventAdapter.js` consuming `SimulationEvents`.
  - Wire `Game.js` to coordinate `GameSimulation` via the adapters.
- **Verification Gate**:
  - `npm test` passes 44/45 suites with zero regressions.
  - Launch game via dev server / browser; verify dual-player movement, chain strain, saw spin, enemy combat, and audio triggers function identically.

### Milestone 4: Performance Optimization & Dead Code Removal
- **Actions**:
  - Cache static room `unstainableRects` on `Room` to eliminate per-frame GC churn.
  - Optimize `Game._renderView` drawable iteration to remove double `.filter()` array allocations.
  - Cache/pool `getSawPositions` output to eliminate 20–40 object allocations per step.
  - Add AABB bounding-box early-out to `Physics.resolveBoxCollisions`.
  - Inline contact testing in `ChainObstacleSystem._findContact`.
  - Delete 7 verified dead methods (`Chain.applyToEnemies`, `Chain.cycleWeapon`, `Weapon.hitsTarget`, `SawWeapon.hitsTarget`, `ParticleSystem.triggerExplosion`, `BloodCanvas.stampGib`, `PostProcessor.addAreaLight`).
  - Remove unused named imports in active modules and obsolete hazard configs.
- **Verification Gate**:
  - `npm test` passes 44/45 suites.
  - Zero broken imports or missing reference errors.
  - Measurable reduction in per-frame heap allocations.

### Milestone 5: Regression Gate, E2E Verification & Final Audit
- **Actions**:
  - Execute full test suite `npm test` (0 regressions).
  - Execute map validation `npm run validate:map` (0 errors).
  - Execute definition-of-done gate `npm run check`.
  - Verify complete browser game execution without console errors.
  - Forensic integrity audit ensuring no hardcoded mocks or facade logic.
- **Verification Gate**:
  - All automated checks green. `main` branch pristine. Clean feature branch ready for merge.
