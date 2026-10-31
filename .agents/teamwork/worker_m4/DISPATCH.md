# Dispatch: Worker M4 — Performance Optimization & Dead Code Removal

## Assignment
Execute Milestone 4 according to `PROJECT.md` and `ARCHITECTURE_PROPOSAL.md`:

1. **Performance Optimization (Requirement R4)**:
   - **Cache `unstainableRects`**:
     In `js/rooms/DungeonTileQuery.js` and `js/rooms/Room.js`, cache the computed `unstainableRects` array on the `Room` instance during initialization instead of re-instantiating `Set`, string keys `${c},${r}`, and rect objects on every frame at 60 FPS in `Game._renderView`.
   - **Eliminate Double `.filter()` in `_renderView`**:
     In `js/Game.js` around line 1450–1480, replace the two separate `.filter(e => sortKey(e) <= sawY)` and `.filter(e => sortKey(e) > sawY)` passes with a single pass or partitioned iteration over the sorted array to eliminate unnecessary per-frame array allocations.
   - **AABB Broadphase in `Physics.resolveBoxCollisions`**:
     In `js/core/Physics.js` (and `js/sim/math/PhysicsSim.js`), add an AABB early-out test (`circle.x + r < box.x || circle.x - r > box.x + box.w || circle.y + r < box.y || circle.y - r > box.y + box.h`) before computing `Math.hypot` against wall boxes.
   - **Saw Position Allocation Reuse**:
     In `js/weapons/SawWeapon.js` (and `js/sim/models/SawModel.js`), pre-allocate / pool the return objects of `getSawPositions` to eliminate 20–40 object allocations per step.
   - **Inline Point Testing in `ChainObstacleSystem._findContact`**:
     In `js/systems/ChainObstacleSystem.js`, test sample points inline instead of allocating a temporary array of points.

2. **Dead Code Removal (Requirement R4)**:
   - Delete 7 verified dead methods with 0 callers in the repository:
     1. `Chain.applyToEnemies` (`js/core/Chain.js:157`)
     2. `Chain.cycleWeapon` (`js/core/Chain.js:62`)
     3. `Weapon.hitsTarget` (`js/weapons/Weapon.js:13`)
     4. `SawWeapon.hitsTarget` (`js/weapons/SawWeapon.js:303`)
     5. `ParticleSystem.triggerExplosion` (`js/particles/ParticleSystem.js:235`)
     6. `BloodCanvas.stampGib` (`js/particles/BloodCanvas.js:146`)
     7. `PostProcessor.addAreaLight` (`js/systems/PostProcessor.js:39`)
   - Remove unused named imports in active modules:
     - `js/rooms/ModularGrid.js:1`: `RoomSocket`
     - `js/systems/CageEncounter.js:2`: `Physics`
     - `js/systems/ChallengeCorridor.js:1`: `ROOM_COLS`, `ROOM_ROWS`
     - `js/trailer/scenes/montage/SplitShot.js:1`: `lerp`, `clamp01`
   - Clean up dead config properties in `js/config/GameConfig.js` (`HAZARDS.spike.hiddenFrames`, `warnFrames`, `exposedFrames`, `retractFrames`, and unused procedural `TORCHES` configs).
   - Ensure ZERO dangling imports or missing reference errors are left behind.

3. **Verification**:
   - Write a benchmark / verification test `tests/test_performance_and_hygiene.js` verifying:
     - Zero references to deleted dead methods.
     - `unstainableRects` is cached and returns identical geometry.
     - AABB broadphase collision produces identical resolution to brute force.
     - Node syntax checks across all touched files pass with exit code 0.
   - Run `npm test` and verify that all 47 baseline tests pass with zero regressions.
   - Run `npm run validate:map` and verify 0 errors.
   - Run `npm run check` and verify definition-of-done gate status.

## Mandatory Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Output your report to: `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\worker_m4\handoff.md`
Notify the orchestrator via `send_message` when complete.


## 2026-10-30T09:07:45Z
You are Worker M4 (Performance Optimization & Dead Code Removal).
Your working directory is: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\worker_m4\
Original request path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\ORIGINAL_REQUEST.md
Dispatch instructions path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\worker_m4\DISPATCH.md
Project specification: c:\Users\Usuario\Desktop\dungeon-chained\PROJECT.md
Architecture proposal: c:\Users\Usuario\Desktop\dungeon-chained\ARCHITECTURE_PROPOSAL.md

Your mission:
1. Read ORIGINAL_REQUEST.md, DISPATCH.md, PROJECT.md, and ARCHITECTURE_PROPOSAL.md.
2. Implement performance optimizations:
   - Cache static unstainableRects on Room objects in js/rooms/DungeonTileQuery.js / Room.js.
   - Eliminate double .filter() array allocations in js/Game.js _renderView.
   - Add AABB early-out broadphase in js/core/Physics.js (resolveBoxCollisions) and js/sim/math/PhysicsSim.js.
   - Pre-allocate / pool saw position objects in js/weapons/SawWeapon.js and js/sim/models/SawModel.js.
   - Inline sample points in js/systems/ChainObstacleSystem.js.
3. Remove dead code:
   - Delete 7 dead methods (Chain.applyToEnemies, Chain.cycleWeapon, Weapon.hitsTarget, SawWeapon.hitsTarget, ParticleSystem.triggerExplosion, BloodCanvas.stampGib, PostProcessor.addAreaLight).
   - Remove unused named imports in ModularGrid.js, CageEncounter.js, ChallengeCorridor.js, SplitShot.js.
   - Remove unused hazard and torch configs in js/config/GameConfig.js.
   - Verify zero dangling imports or broken references across the entire codebase.
4. Create tests/test_performance_and_hygiene.js validating the optimizations and dead code removal.
5. Run npm test to verify all tests pass with zero regressions.
6. Maintain progress.md in your working directory with 'Last visited: [timestamp]'.
7. Write your complete handoff report to handoff.md in your working directory and notify the parent orchestrator via send_message when complete.
