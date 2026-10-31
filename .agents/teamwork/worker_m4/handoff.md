# Handoff Report: Worker M4 — Performance Optimization & Dead Code Removal

## 1. Observation
- **Baseline Test Status**: Executed `npm test` prior to code changes:
  `47/48 test files passed` (`test_modular_grid.js` failed at `"Curva SE"` assert, documented as pre-existing known bug #5 in `status.md:43`).
- **Dead Methods Verification**:
  Direct grep queries across the repository revealed 0 callers for all 7 candidate methods:
  1. `Chain.applyToEnemies` (`js/core/Chain.js:157`) — 0 callers. Additionally, `Physics` was not imported in `Chain.js`, proving it would throw a `ReferenceError` if ever invoked.
  2. `Chain.cycleWeapon` (`js/core/Chain.js:62`) — 0 callers.
  3. `Weapon.hitsTarget` (`js/weapons/Weapon.js:13`) — 0 callers.
  4. `SawWeapon.hitsTarget` (`js/weapons/SawWeapon.js:303`) — 0 callers.
  5. `ParticleSystem.triggerExplosion` (`js/particles/ParticleSystem.js:235`) — 0 callers.
  6. `BloodCanvas.stampGib` (`js/particles/BloodCanvas.js:146`) — 0 callers.
  7. `PostProcessor.addAreaLight` (`js/systems/PostProcessor.js:39`) — 0 callers.
- **Unused Imports**:
  - `js/rooms/ModularGrid.js:5`: `RoomSocket` was imported but never referenced in the module.
  - `js/systems/CageEncounter.js:2`: `Physics` was imported but never referenced.
  - `js/systems/ChallengeCorridor.js:4`: `ROOM_COLS` and `ROOM_ROWS` were imported from `GameConfig.js` but never used.
  - `js/trailer/scenes/montage/SplitShot.js:3`: `lerp` and `clamp01` were imported from `../../anim.js` but never used.
- **Dead Config Properties**:
  - `js/config/GameConfig.js:431-434`: `HAZARDS.spike.hiddenFrames`, `warnFrames`, `exposedFrames`, `retractFrames` were unused because `SpikeTrap.js` uses seconds-based `durations` profiles.
  - `js/config/GameConfig.js:281-291`: `TORCHES.minPerWall`, `maxPerWall`, `marginTiles`, `minGap`, `onlyCombatRooms`, `sides` were obsolete remnants of legacy procedural torch placement.
- **Hot-Path Allocations Observed**:
  - `DungeonTileQuery.unstainableRects` (`js/rooms/DungeonTileQuery.js:40-55`) allocated a new `Set`, string keys `${c},${r}`, and an array of rect objects at 60 FPS in `Game._renderView:1477`.
  - `Game._renderView` (`js/Game.js:1526, 1535`) executed `.filter(e => sortKey(e) <= sawY)` and `.filter(e => sortKey(e) > sawY)` on an already-sorted `drawables` array, allocating 2 new arrays per frame.
  - `Physics.resolveBoxCollisions` (`js/core/Physics.js:148-167`) computed `Math.hypot` for every wall box using a `.forEach` callback without early bounding-box culling.
  - `SawWeapon.getSawPositions` (`js/weapons/SawWeapon.js:291-301`) and `SawModel.getSawPositions` (`js/sim/models/SawModel.js:108-124`) allocated new arrays and object literals `{ x, y, radius }` on every physics step and render query.
  - `ChainObstacleSystem._findContact` (`js/systems/ChainObstacleSystem.js:50-85`) allocated temporary `points` arrays and spread objects on every solver iteration.
- **Post-Refactoring Test Status**:
  - Executed `node tests/test_performance_and_hygiene.js`: 7/7 test suites passed with exit code 0.
  - Executed `npm test`: `48/49 test files passed` (all 48 passing tests green, 0 regressions, baseline issue #5 unchanged).
  - Executed `npm run validate:map`: `0 error(s), 2 warning(s)`.
  - Executed `npm run check`: map validation, docs drift, graph update (3681 nodes, 7411 edges) all succeeded.

## 2. Logic Chain
1. *From Observation of `DungeonTileQuery.unstainableRects`*: The floor and wall layout of a `Room` is static once initialized. By precomputing `this.unstainableRects` in `Room.constructor` (`js/rooms/Room.js`) using `bounds.minX - TILE` and `bounds.minY - TILE`, `DungeonTileQuery.unstainableRects()` directly returns `this.rooms.current.unstainableRects`. This converts an O(tiles) Set/object allocation per frame at 60 FPS into an O(1) cached pointer access, eliminating per-frame GC churn.
2. *From Observation of `Game._renderView`*: `drawables` is already sorted by `sortKey` via `.sort((a, b) => sortKey(a) - sortKey(b))`. Therefore, all items where `sortKey(e) <= sawY` precede those where `sortKey(e) > sawY`. Partitioning iteration at `splitIdx` preserves exact drawing order while eliminating both `.filter()` array allocations per frame.
3. *From Observation of `Physics.resolveBoxCollisions`*: A circle of radius `r` centered at `(x, y)` cannot intersect an axis-aligned box `[b.x, b.x + b.w] x [b.y, b.y + b.h]` if `x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h`. By inserting this branch and replacing `.forEach` with an indexed `for` loop, distant wall boxes bypass expensive `Math.hypot` operations. A 200-point randomized comparison verified bit-identical collision resolution against the brute force reference.
4. *From Observation of `getSawPositions`*: In game loops, saw positions are consumed immediately within the frame for collision or drawing. Pre-allocating `_sawPosPool`, `_singleSawArray`, and `_doubleSawArray` on `SawWeapon` and `SawModel` and updating coordinate values in place eliminates 20–40 heap allocations per 60 Hz tick while maintaining identical contract output.
5. *From Observation of `ChainObstacleSystem._findContact`*: Evaluating sample points and saw discs inline via `testPoint(px, py, radius, kind)` without pushing into an intermediate array eliminates temporary arrays and `{ ... }` spread allocations entirely during chain constraint solving.
6. *From Observation of dead methods and unused imports*: Grepping verified 0 callers across all modules. Deleting the methods and removing unused imports produced 0 broken references and passed Node syntax checks across all 19 touched files.

## 3. Caveats
- `tests/test_modular_grid.js` remains the sole failing test suite (48/49 passing). This failure was verified to be pre-existing prior to this milestone (documented as bug #5 in `status.md`).
- Object reuse in `getSawPositions` means callers should not store returned array/object references across subsequent frames; callers in this repository already process or destruct the returned array immediately within the same tick.

## 4. Conclusion
Milestone 4 requirements (R4) are completely satisfied:
- All 5 hot-path performance bottlenecks have been refactored for zero/low GC allocation and early-out culling.
- All 7 verified dead methods have been deleted.
- All 4 unused import statements and dead config properties have been cleanly excised.
- The new test suite `tests/test_performance_and_hygiene.js` validates dead code removal, caching, collision equivalence, object pooling, and Node syntax across all 19 touched files.
- Zero regressions introduced: 48/49 tests pass, map validation reports 0 errors.

## 5. Verification Method
To independently verify:
1. Run performance and hygiene tests:
   ```bash
   node tests/test_performance_and_hygiene.js
   ```
   *Expected*: Exit code 0, all 7 sections pass.
2. Run full test suite:
   ```bash
   npm test
   ```
   *Expected*: `48/49 test files passed` (only known pre-existing `test_modular_grid.js` fails).
3. Run map validation:
   ```bash
   npm run validate:map
   ```
   *Expected*: 24 pieces, 24 listed, 0 error(s).
4. Verify zero dangling references to deleted methods:
   ```bash
   node -e "const cp = require('child_process'); for (const m of ['applyToEnemies', 'cycleWeapon', 'hitsTarget', 'triggerExplosion', 'stampGib', 'addAreaLight']) { try { const out = cp.execSync('git grep -n ' + m + ' js/').toString().trim(); if (out) throw new Error('Found ' + m + ': ' + out); } catch (e) { if (e.message.startsWith('Found')) throw e; } } console.log('Zero dangling references confirmed.');"
   ```
   *Expected*: "Zero dangling references confirmed."
