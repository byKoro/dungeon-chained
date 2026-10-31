# Dispatch: Worker M2 — Engine-Agnostic Simulation Core Extraction

## Assignment
Execute Milestone 2 according to `PROJECT.md` and `ARCHITECTURE_PROPOSAL.md`:

1. **Construct `js/sim/` Engine-Agnostic Core**:
   Extract and construct pure, zero-dependency modules in `js/sim/`:
   - `js/sim/math/Vec2.js`: Pure 2D vector class/struct (`x, y`, `add`, `sub`, `scale`, `len`, `normalize`, `dist`, `dot`).
   - `js/sim/math/Rect2D.js`: Pure 2D AABB (`x, y, w, h`, `contains`, `intersects`).
   - `js/sim/math/PhysicsSim.js`: Pure math collision & constraint solver extracted from `Physics.js` and `ChainObstacleSystem.js` (`applyChainConstraint`, `distToSegment`, `resolveCircleCollision`, `resolveBoxCollisions`, `findContactPoint`).
   - `js/sim/models/PlayerModel.js`: Pure player simulation extracted from `Player.js` (position, velocity, hit radius, base speed, lives, max lives, timers: invulnerable, hurt, scared, slide; dash state machine, hole falling physics). ZERO Canvas 2D or DOM references.
   - `js/sim/models/TetherModel.js`: Pure cable dynamics extracted from `Chain.js` (rest distance, stiffness, break distance, strain limit, reconnection logic).
   - `js/sim/models/SawModel.js`: Pure saw dynamics extracted from `SawWeapon.js` (spin speed, rotation, drag offset, dropped state, inertia, dropped pushback velocity).
   - `js/sim/models/EnemyModel.js`: Pure enemy AI state machines extracted from `MeleeEnemy.js`, `FlameGolemEnemy.js`, `GhostfireBoss.js`, `CultistEnemy.js` (AI states: Chase, Windup, Attack, Recover, Hurt, Stunned, Dying, Dead; hp, poise, 4-dir BFS path).
   - `js/sim/models/CombatSim.js`: Pure combat hit detection and damage resolution extracted from `CombatSystem.js` (hitbox overlaps, damage calculations, poise degradation, hit-stop durations). Returns domain events instead of directly playing audio/shake.
   - `js/sim/models/DungeonSim.js`: Pure dungeon room bounds, floor grid, hole detection, and safe spawn queries extracted from `DungeonTileQuery.js` and `SafeSpawn.js`.
   - `js/sim/events/SimulationEvents.js`: Pure lightweight event buffer class that queues event structs (`SawSnapped`, `SawReconnected`, `SawHit`, `EntityDamaged`, `EntityDied`, `PlayerFootstep`, `PlayerFell`, `PlayerDashed`, `CameraShake`).
   - `js/sim/GameSimulation.js`: Master deterministic 60Hz step coordinator (`step(inputSnapshot): SimulationEvents`) encapsulating the pure update loop and providing `getRenderSnapshot()`.

2. **Decouple DOM Offscreen Canvases from Existing Entity Code**:
   - In `js/entities/Player.js:369`, `js/entities/MeleeEnemy.js:11,29`, `js/weapons/SawWeapon.js:412,608`, and `js/entities/HeartPickup.js:87,116`, ensure tinting and flash canvas buffers are guarded or lazy-loaded only when Canvas 2D rendering actually executes, never during simulation initialization or headless execution.

3. **Verification**:
   - Verify every module in `js/sim/` has ZERO references to `window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `AudioContext`, `HTMLImageElement`, or `CanvasRenderingContext2D`.
   - Write a unit test `tests/test_simulation_core.js` validating that `GameSimulation` and its sub-models run in pure headless Node without any browser globals or mocks.
   - Run `npm test` and verify that all 44 baseline tests pass with zero regressions plus the new simulation test passes (45/46 passing).
   - Run `node --check` across all new files in `js/sim/`.

## Mandatory Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Output your report to: `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\worker_m2\handoff.md`
Notify the orchestrator via `send_message` when complete.

## 2026-10-30T08:21:59Z
You are Worker M2 (Engine-Agnostic Simulation Core Extraction).
Your working directory is: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\worker_m2\
Original request path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\ORIGINAL_REQUEST.md
Dispatch instructions path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\worker_m2\DISPATCH.md
Project specification: c:\Users\Usuario\Desktop\dungeon-chained\PROJECT.md
Architecture proposal: c:\Users\Usuario\Desktop\dungeon-chained\ARCHITECTURE_PROPOSAL.md
