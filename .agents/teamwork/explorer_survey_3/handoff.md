# Handoff Report: Explorer Survey 3 — Performance, Dead Code, Test Infrastructure & Tooling

**Agent**: Explorer Survey 3  
**Date**: 2026-10-30T08:05:00Z  
**Directory**: `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_3\`  
**Milestone**: Survey 3: Performance Bottlenecks, Dead Code, Test Infrastructure & Tooling Audit  

---

## 1. Observation

Direct observations and evidence obtained from codebase audits, test suite executions, and script-based dependency graphs.

### A. Git Status & Requirement R1 (Branch Isolation)
- **Current Branch**: `main`.
- **Remote Divergence**: Local `main` is behind `origin/main` by 2 commits:
  - `829cf47`: `arrow trap fix, agora ela bate em parede e para.`
  - `517d9af`: `feat(stairs): add stair connections as interior and border map passages`
- **Working Tree State**:
  - 46 modified unstaged files (`js/Game.js`, `js/combat/CombatSystem.js`, `js/core/Chain.js`, `js/core/Renderer.js`, `js/rooms/DungeonTileQuery.js`, `js/systems/RoomEvents.js`, etc.).
  - 6 untracked files:
    - `.agents/teamwork/`
    - `js/particles/ShockRing.js`
    - `js/systems/PlayerLeash.js`
    - `js/systems/RopeChests.js`
    - `js/systems/StakeRope.js`
    - `tests/test_rope_chest.js`
  - Context confirmation (`.agents/context/status.md:185-252`): These edits represent recently implemented and verified features from 2026-10-30 (wall render order v3, immediate hole fall, solid stake / dropped saw push, interact prompt, blood clipping, forge updates, and chest ropes) that have not yet been committed to a branch.
- **Requirement R1 Constraint**: All refactoring and architectural work must occur on a dedicated feature branch off `main` without leaving `main` dirty.

### B. Test Suite & Verification Baseline
- **`npm test` Execution** (`node scripts/run-tests.mjs`):
  - Total test files: 45 files.
  - Passing: 44 files.
  - Failing: 1 file (`tests/test_modular_grid.js`):
    ```
    FAIL  test_modular_grid.js
          ✅ PASSOU: Canto inferior esquerdo é parede (40)
          ✅ PASSOU: Canto inferior direito é parede (45)
          ✅ PASSOU: Porta Norte esculpida nas colunas centrais 6 e 7
          ✅ PASSOU: Porta Leste esculpida nas linhas centrais 3 e 4
          ✅ PASSOU: Pedra especial espelhada perfeitamente para o lado Oeste na Curva NW!
          ❌ FALHOU: Pedra especial espelhada perfeitamente para o Sul na Curva SE!
          Error: Pedra especial espelhada perfeitamente para o Sul na Curva SE!
              at assert (tests/test_modular_grid.js:16:15)
              at tests/test_modular_grid.js:281:5
    ```
    - Corresponds to pre-existing known bug #5 in `.agents/context/status.md:43`.
- **`npm run validate:map` Execution** (`node scripts/validate-map.mjs`):
  - Total room files: 24 pieces in `map/`.
  - Listed in `map/index.json`: 23 pieces.
  - Errors: 1 error (`ERROR corridor_vertical_ns_1.json: exists in map/ but is not listed in map/index.json (never loaded)`).
  - Warnings: 2 warnings (`corredor_ne_01.json: file name does not follow convention`, `coverage: no boss piece`).
  - Corresponds to pre-existing known bug #4 in `.agents/context/status.md:42`.
- **`npm run check` Execution** (`node scripts/check.mjs`):
  - Fails on step 1 (tests) and step 2 (map validation), exactly reflecting issues #5 and #4.
  - Passes step 3 (docs drift: `OK code + docs changed`) and step 4 (graphify code graph update).
- **`npm run doctor` Execution** (`node scripts/doctor.mjs`):
  - All environments and dependencies pass: Node v24.16.0, Python 3.12.10, Electron installed, `graphifyy` 0.9.38 on PATH, `graphify-out/graph.json` present, git present.

### C. Dead Code & Obsolete Artifacts
Audited across all 190 JS files in `js/`, all files in `map/`, and 261 assets in `assets/`:

1. **Unreachable / Unused JS Files**:
   - `js/rooms/ModularGrid.js` (167 lines): Never imported anywhere in game runtime or editor entry points. Only imported in `tests/test_modular_grid.js:6`.
   - `js/rooms/RoomArchetypes.js` (477 lines): A 18 KB legacy module for procedural archetype flipping. Only imported in `tests/test_modular_grid.js:236` and as two unreferenced/dangling imports:
     - `js/rooms/RoomCatalog.js:1` (`applyImmutableFrame` only in `_adaptToDoors` for start/boss fallback).
     - `js/rooms/Room.js:4` (`GlobalRoomVariantCatalog` referenced at line 31 as dead fallback).
2. **Dead Functions & Methods**:
   - `Chain.applyToEnemies` (`js/core/Chain.js:157`): 0 callers in entire repository (superseded by `CombatSystem`).
   - `Chain.cycleWeapon` (`js/core/Chain.js:62`): 0 callers in entire repository.
   - `Weapon.hitsTarget` (`js/weapons/Weapon.js:13`): 0 callers in entire repository.
   - `SawWeapon.hitsTarget` (`js/weapons/SawWeapon.js:303`): 0 callers in entire repository.
   - `ParticleSystem.triggerExplosion` (`js/particles/ParticleSystem.js:235`): 0 callers in entire repository.
   - `BloodCanvas.stampGib` (`js/particles/BloodCanvas.js:146`): 0 callers in entire repository.
   - `PostProcessor.addAreaLight` (`js/systems/PostProcessor.js:39`): 0 callers in entire repository.
3. **Dead / Obsolete Config Properties**:
   - `HAZARDS.spike.hiddenFrames`, `warnFrames`, `exposedFrames`, `retractFrames` (`js/config/GameConfig.js:431-434`): Unused legacy frame numbers. `SpikeTrap.js` uses seconds-based `timingProfiles`.
   - `TORCHES.minPerWall`, `maxPerWall`, `marginTiles`, `minGap`, `onlyCombatRooms`, `sides` (`js/config/GameConfig.js:281-291`): Procedural torch generation config never read anywhere.
4. **Unused Named Imports in Active Code**:
   - `js/rooms/ModularGrid.js:1`: `RoomSocket`
   - `js/systems/CageEncounter.js:2`: `Physics`
   - `js/systems/ChallengeCorridor.js:1`: `ROOM_COLS`, `ROOM_ROWS`
   - `js/trailer/scenes/montage/SplitShot.js:1`: `lerp`, `clamp01`
5. **Asset & Map Discrepancies**:
   - `map/corridor_vertical_ns_1.json`: Valid authored room piece omitted from `map/index.json`.
   - `assets/tileset/tileset_2.png` through `tileset_6.png`: Requested in loop by `AssetLoader.js:42`, generating 5 HTTP 404 network errors at boot (only `tileset.png` and `tileset_1.png` exist in `assets/tileset/`).
   - `AudioConfig.js`: `monsterHurt` and `enemyAttackVoice` audio cues have `files: []` and `enabled: false`.
   - `assets/audio/arauto-sources.md`, `assets/bars/README.md`, `assets/cage/README.md`: Markdown doc files committed inside asset directories.

### D. Performance Bottlenecks & Hot Loops
Audited across the 60 Hz simulation and presentation tick paths:

1. **`unstainableRects` Recomputation Every Frame**:
   - `DungeonTileQuery.unstainableRects()` (`js/rooms/DungeonTileQuery.js:40-55`) is called every frame in `Game._renderView` (`js/Game.js:1421`).
   - It instantiates a `new Set()`, iterates through the entire 2D matrix of `tiles.floor` (126 cells) with nested `forEach`, generates string keys (`${c},${r}`), and allocates `{ x, y, w, h }` for every hole and wall.
   - Room walls and holes are static. Computing this at 60 FPS creates continuous garbage collection churn.
2. **Drawable Array Allocation & Double Filter in `_renderView`**:
   - In `Game._renderView` (`js/Game.js:1453-1479`):
     - `renderer.wallDrawables()` constructs a `new Map(...)` and closure wrappers `{ y, feetSortY, draw }` for every wall tile every frame.
     - `drawables = [...entities, ...(rooms.current.corpses ?? []), ...occluders, ...propDrawables].sort(...)` creates a large combined array and sorts it.
     - Then executes two separate filter passes: `drawables.filter(e => sortKey(e) <= sawY).forEach(...)` and `drawables.filter(e => sortKey(e) > sawY).forEach(...)`, allocating two more arrays every frame.
3. **Repeated `getSawPositions` Allocations in Hot Simulation Loops**:
   - `SawWeapon.getSawPositions(p1, p2)` (`js/weapons/SawWeapon.js:291-301`) allocates `{x, y}` objects in `cablePoint` and returns a new mapped array `[{ x, y, radius }]`.
   - It is invoked 10–15 times per frame across physics collision iterations (`Game.js:1162`), combat hit checks (`CombatSystem.js:101`), obstacle resolution (`ChainObstacleSystem.js:57`), spark particle emitters (`Game.js:1112`), shadow rendering, and lighting passes.
4. **Collision Broadphase Absence & Unconditional `Math.hypot`**:
   - `Physics.resolveBoxCollisions` (`js/core/Physics.js:148-167`): For each entity (`p1`, `p2`, live enemies), iterates over all room wall boxes (50–100 boxes) and computes `Math.hypot(distX, distY)` with zero AABB early-out.
   - `Physics.resolveEntityCollisions` (`js/core/Physics.js:37-89`): O(N^2) pairwise check executed 3 times per step, running normalized distance calculations and square roots for every pair.
5. **`ChainObstacleSystem._findContact` High-Frequency Allocations**:
   - `ChainObstacleSystem._findContact` (`js/systems/ChainObstacleSystem.js:50-85`):
     - Allocates a `points = []` array and 8–16 sample point objects every call.
     - Called up to 6 times per frame (2 calls per iteration × 3 iterations).
6. **Canvas 2D Light Rasterization Overhead**:
   - `PostProcessor.js` (`js/systems/PostProcessor.js:35-60, 83-147`): Allocates dozens of light descriptor objects into `_lights` each frame, creating radial and linear canvas gradients with string color stops `rgba(${lc}, ${stop.alpha})` at runtime.
7. **Blood Zone Linear Search**:
   - `BloodCanvas.isBloodZone` (`js/particles/BloodCanvas.js:40-47`): Linearly scans an array of up to 200 zones on every frame in `Game._updateGameplay:1123`.

---

## 2. Logic Chain

1. **Premise 1 (Git Isolation)**:
   - Requirement R1 explicitly specifies: *"Create and perform all work on a dedicated feature branch off main, keeping main untouched."*
   - Current observation confirms branch `main` has 46 modified files and 6 untracked files representing the 2026-10-30 feature set.
   - **Inference**: Before starting any architectural refactoring, the working tree must be committed or branched to preserve the existing verified work, ensuring `main` can be cleanly restored and isolated.

2. **Premise 2 (Test Baseline & Verification Gate)**:
   - `npm test` has 44/45 passing tests, with only `test_modular_grid.js` failing (Bug #5).
   - `npm run validate:map` has 1 error: `corridor_vertical_ns_1.json` missing from `map/index.json` (Bug #4).
   - `npm run check` fails on these exact two items.
   - **Inference**: These two pre-existing failures are well-isolated and documented in `status.md`. The refactoring must not introduce any new failures beyond these known baseline issues.

3. **Premise 3 (Dead Code Removal Safety)**:
   - `Chain.applyToEnemies`, `Chain.cycleWeapon`, `Weapon.hitsTarget`, `SawWeapon.hitsTarget`, `ParticleSystem.triggerExplosion`, `BloodCanvas.stampGib`, `PostProcessor.addAreaLight` have zero references across the codebase.
   - `ModularGrid.js` and `RoomArchetypes.js` are never required for active game runtime.
   - `AssetLoader.js` requests non-existent `tileset_2..6.png`.
   - **Inference**: Deleting these dead functions and unused files, fixing the missing tileset loop, and adding `corridor_vertical_ns_1.json` to `map/index.json` will clean up technical debt and directly resolve Bug #4 without breaking any runtime feature.

4. **Premise 4 (Performance & Portability Synergies)**:
   - For a future Unity C# port (Requirement R2/R3), simulation logic must be engine-agnostic and avoid continuous heap allocations.
   - In JS, the biggest frame time and GC spikes come from per-frame array allocations (`unstainableRects`, `drawables.filter`, `getSawPositions`, `_findContact` points, and `resolveBoxCollisions` without AABB checks).
   - **Inference**: Decoupling simulation from DOM/Canvas and introducing scalar caching (pre-allocating saw positions, caching static room unstainable rects, splitting drawable loops without `.filter()`, and adding AABB early-outs) simultaneously satisfies Requirement R4 (Performance) and Requirement R3 (Portability).

---

## 3. Caveats

1. **Browser GUI / Live Audio**: This survey is a read-only code and test suite investigation. Actual subjective audio levels, CRT shaders, and browser feel were not playtested live.
2. **Pre-existing Working Tree State**: 46 files in the working directory contain uncommitted work from previous tasks on 2026-10-30. The orchestrator must decide whether to commit these changes to a preparatory branch or branch directly from the current working tree.
3. **Editor 1 vs Editor 2.0**: `EditorApp.js` (legacy editor) is protected by rules in `AGENTS.md` and uses `RoomPresets.js`. Removing `RoomPresets.js` or `EditorApp.js` would violate `AGENTS.md`.

---

## 4. Conclusion

The codebase is functionally intact (44/45 test suites pass, environment is healthy), but contains notable technical debt, dead code, and easily fixable hot-path performance bottlenecks that directly align with Requirements R1–R5:

1. **Branch Isolation (R1)**: A dedicated feature branch (e.g. `feat/architecture-replatform`) must be branched immediately to contain all refactoring commits.
2. **Dead Code Cleanup (R4)**:
   - Delete 7 dead methods (`Chain.applyToEnemies`, `Chain.cycleWeapon`, `Weapon.hitsTarget`, `SawWeapon.hitsTarget`, `ParticleSystem.triggerExplosion`, `BloodCanvas.stampGib`, `PostProcessor.addAreaLight`).
   - Clean up dead configs (`HAZARDS.spike.*Frames`, `TORCHES.minPerWall/...`).
   - Remove unused imports (`ModularGrid.js`, `CageEncounter.js`, `ChallengeCorridor.js`, `SplitShot.js`).
   - Restrict `AssetLoader` to existing tilesets (`tileset.png`, `tileset_1.png`) to eliminate 404 network spam.
   - Register `corridor_vertical_ns_1.json` in `map/index.json` to resolve Bug #4.
3. **Performance Optimization (R4)**:
   - Cache `unstainableRects()` on the `Room` object instead of recomputing every frame.
   - Refactor `Game._renderView` drawable iteration to eliminate two `.filter()` passes and reuse a pre-allocated array.
   - Cache / pool `getSawPositions()` to eliminate 20–40 object allocations per step.
   - Add AABB early-out in `Physics.resolveBoxCollisions` to skip `Math.hypot` for non-adjacent wall tiles.
   - Avoid array allocations in `ChainObstacleSystem._findContact` by testing points inline.
   - Replace linear `isBloodZone` with a coarse spatial grid or early reject.
4. **Test Baseline Gate (R5)**:
   - Accept the 44/45 passing tests as the baseline; maintain 0 regressions on all 44 suites during every refactoring stage.

---

## 5. Verification Method

Independent verification steps for the implementation phase:

1. **Run Automated Test Suite**:
   ```powershell
   npm test
   ```
   *Expected*: Exactly 44/45 tests PASS (only `test_modular_grid.js` fails on known Bug #5).
2. **Run Map Validation**:
   ```powershell
   npm run validate:map
   ```
   *Expected*: Once `corridor_vertical_ns_1.json` is listed in `map/index.json`, this must PASS with 0 errors.
3. **Run Full Definition-of-Done Gate**:
   ```powershell
   npm run check
   ```
   *Expected*: Passes tests, map validation, docs drift, and graphify update.
4. **Inspect Git Isolation**:
   ```powershell
   git status
   git branch
   ```
   *Expected*: On feature branch; `main` branch clean and isolated.
5. **Inspect No Dangling Imports**:
   Verify via node import check that no deleted exports cause runtime `ReferenceError` or `SyntaxError`.
