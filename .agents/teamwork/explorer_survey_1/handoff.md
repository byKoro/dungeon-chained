# Handoff Report: Explorer Survey 1 — Core Simulation & Mechanics

## 1. Observation

### 1.1 Codebase Survey & Current Responsibilities
A comprehensive investigation of the codebase in `js/` and related documentation identified 7 primary simulation domains:
1. **Physical Math & Constraints**: `js/core/Physics.js`, `js/systems/ChainObstacleSystem.js`, `js/systems/PlayerLeash.js`, `js/systems/DroppedSawPush.js`.
2. **Player Simulation**: `js/entities/Player.js`, `js/entities/PlayerFactory.js`, `js/entities/Entity.js`, `js/config/EntityConfig.js`, `js/config/GameConfig.js`.
3. **Tether & Cable Dynamics**: `js/core/Chain.js`, `js/config/ChainConfig.js`.
4. **Weapon & Saw Mechanics**: `js/weapons/Weapon.js`, `js/weapons/SawWeapon.js`, `js/systems/SawDrag.js`, `js/systems/ThrownSaw.js`, `js/config/SawWeaponConfig.js`, `js/config/ForgeConfig.js`.
5. **Combat, Hit Detection & Damage**: `js/combat/CombatSystem.js`, `js/config/CombatFeelConfig.js`.
6. **Entity AI, Bosses & Traps**: `js/entities/MeleeEnemy.js`, `js/entities/FlameGolemEnemy.js`, `js/entities/GhostfireBoss.js`, `js/entities/CultistEnemy.js`, `js/entities/FireSkullEnemy.js`, `js/entities/SpikeTrap.js`, `js/entities/ArrowTrap.js`, `js/entities/PressureButton.js`, `js/entities/HeartPickup.js`, `js/entities/ScrapPickup.js`, `js/systems/ChallengeCorridor.js`.
7. **Dungeon Generation, Room Graph & Placement**: `js/core/DungeonGraph.js`, `js/core/Dungeon.js`, `js/core/RoomTiles.js`, `js/rooms/Room.js`, `js/rooms/RoomManager.js`, `js/rooms/RoomCatalog.js`, `js/rooms/DungeonTileQuery.js`, `js/rooms/SafeSpawn.js`, `js/rooms/AuthoredDungeon.js`.

### 1.2 Verbatim Couplings & Platform Invasions

#### A. Direct DOM / Browser Canvas Creation in Simulation Classes
Multiple entity and weapon classes directly create HTML canvas elements for software blitting and tinting:
- `js/entities/Player.js` (line 369):
  ```javascript
  if (!this._tintBuf) this._tintBuf = document.createElement('canvas');
  ```
- `js/entities/MeleeEnemy.js` (lines 11 and 29):
  ```javascript
  if (!tintBuf) tintBuf = document.createElement('canvas');
  ...
  if (!silhouetteBuf) silhouetteBuf = document.createElement('canvas');
  ```
- `js/weapons/SawWeapon.js` (lines 412 and 608):
  ```javascript
  this._flashCanvas = document.createElement("canvas");
  ...
  this._beamCanvas = document.createElement("canvas");
  ```
- `js/entities/HeartPickup.js` (lines 87 and 116):
  ```javascript
  const c = document.createElement("canvas");
  ```
- `js/core/PropSprites.js` (lines 51, 69, 98):
  ```javascript
  const c = this._stain ??= document.createElement("canvas");
  ...
  const c = this._shine ??= document.createElement("canvas");
  ...
  const c = document.createElement("canvas");
  ```
- `js/systems/ArautoEffects.js` (lines 23, 95, 105, 162):
  ```javascript
  if (!this.blurCanvas) this.blurCanvas = document.createElement('canvas');
  ```
- `js/systems/StakeRope.js` (line 147):
  ```javascript
  const c = document.createElement("canvas");
  ```

#### B. Direct Mixed Rendering Methods (`draw(ctx)`) inside Entity & Weapon State Objects
Instead of separating data/logic from presentation, simulation classes contain hundreds of lines of Canvas 2D drawing logic:
- `Player.js`: `draw(ctx)`, `_drawAfterimages(ctx)`, `_applyDashScale(ctx)`, `_tintedFrame(sp, color, amount)` directly invoking `CanvasRenderingContext2D` methods (`drawImage`, `fillRect`, `globalCompositeOperation`, `translate`, `rotate`, `scale`).
- `MeleeEnemy.js`: `draw(ctx)`, `drawShadow(ctx)`, `_drawHurt(ctx)`, `_drawDeath(ctx)`.
- `FlameGolemEnemy.js`: `draw(ctx)`, `drawShadow(ctx)` using `ctx.createRadialGradient`, `drawAttackEffect(ctx)` using `ctx.arc`, `ctx.stroke`.
- `GhostfireBoss.js`: `draw(ctx)`, `drawShadow(ctx)`, `drawAttackEffect(ctx)`.
- `CultistEnemy.js`: `drawAttackEffect(ctx)`.
- `SawWeapon.js`: `draw(ctx)`, `drawChain(ctx)`, `drawDropped(ctx)`, `drawAt(ctx)` - comprising over 350 lines of drawing code in a 636-line file.
- `Chain.js`: `drawChain(ctx)`, `draw(ctx)`, `drawDropped(ctx)`.
- `SpikeTrap.js`, `ArrowTrap.js`, `PressureButton.js`, `HeartPickup.js`, `ScrapPickup.js`: all contain embedded `draw(ctx)` methods.

#### C. Direct Calls to Audio, Particles, and Camera Shake in Simulation Loops
The simulation systems do not emit decoupled events; instead, they directly call platform services:
- `js/combat/CombatSystem.js`:
  - Directly plays audio: `this.audio.play("sawHit")`, `this.audio.duck(...)` (lines 35-39), `this.audio.play("playerHurt")` (line 59), `this.audio.play("enemyStep")` (line 64), `this.audio.play("enemyAttack")` (line 66), `this.audio.play("playerFall")` (line 93).
  - Directly triggers particle effects: `this.particleSystem.triggerBlood(...)` (lines 60, 134, 237), `this.particleSystem.triggerHitSparks(...)` (line 232), `this.particleSystem.triggerFlash(...)` (line 233), `this.particleSystem.triggerHitBlood(...)` (line 239), `this.particleSystem.triggerDust(...)` (line 240), `this.particleSystem.triggerDamageNumber(...)` (line 244).
  - Directly triggers camera shake: `this.renderer.triggerShake(...)` (lines 57, 86, 131, 230).
- `js/systems/DroppedSawPush.js`:
  - Directly invokes `this.audio?.play(...)` (line 106), `this.particleSystem?.triggerSparkBurst(...)` (line 108), `this.renderer?.triggerShake(...)` (line 115).
- `js/systems/SawDrag.js`:
  - Directly invokes `this.audio?.play("sawLand")` (line 77), `this.audio?.play("sawSnap")` (line 119), `this.renderer?.triggerShake(...)` (line 120), `this.particleSystem?.triggerSparkBurst(...)` (line 121), and defines `drawRope(ctx)` (lines 129-149).
- `js/systems/PlayerLeash.js`:
  - Directly invokes `this.particleSystem?.triggerDust(...)` (line 74), and queries `this.getView()` (`DemoCamera.viewSize()`).

#### D. Browser Globals (`window`, `document`, `sessionStorage`, `fetch`, `performance.now`)
- `js/rooms/RoomManager.js` (lines 31-33):
  ```javascript
  if (typeof window !== "undefined" && window.sessionStorage) {
      const isPlaytest = window.location.search.includes("playtest=true");
      const raw = window.sessionStorage.getItem("editor_custom_room");
  ```
- `js/systems/PlayerAI.js` (lines 26-30):
  ```javascript
  if (typeof window !== "undefined") {
      window.addEventListener("keydown", (e) => { ... });
      window.playerAI = this;
  }
  ```
- `js/core/InputHandler.js`: Directly listens to `window.addEventListener("keydown" / "keyup" / "blur" / "gamepadconnected")`.
- `js/rooms/RoomCatalog.js` and `js/rooms/DemoMapLoader.js`: Direct use of browser `fetch()` for JSON loading.
- `js/combat/CombatSystem.js` and `js/weapons/SawMotorAudio.js`: Direct use of `globalThis.performance?.now?.()`.

### 1.3 State of Pure Simulation Modules
Certain modules are already 100% pure math/simulation with zero platform dependencies:
- `js/core/Physics.js`: Pure static vector math (`applyChainConstraint`, `distToSegment`, `closestPointOnSegment`, `resolveEntityCollisions`, `resolveCircleCollision`, `resolveBoxCollisions`).
- `js/core/DungeonGraph.js`: Pure graph algorithms (scatter, Prim's MST, corridor carving, neighbor door calculation).
- `js/systems/ChainObstacleSystem.js`: Pure geometric solver for cable/saw contact against immovable body ellipses.

### 1.4 Baseline Test Execution
Executing `npm test` runs 45 standalone ESM test files via `scripts/run-tests.mjs`.
Result: **44/45 PASS**. The single failing test is `test_modular_grid.js` (at line 281: "Pedra especial espelhada perfeitamente para o Sul na Curva SE!"), which is a documented pre-existing known issue (#5 in `status.md`).

---

## 2. Logic Chain

1. **Premise 1**: The overarching project requirement (R3) dictates: "Extract pure domain models and simulation logic into engine-agnostic modules that have zero dependencies on DOM, Canvas 2D contexts, or browser globals, making them directly portable to Unity C#."
2. **Premise 2**: Observation 1.2 demonstrates that entity classes (`Player`, `MeleeEnemy`, `FlameGolemEnemy`, `GhostfireBoss`, `CultistEnemy`, `SpikeTrap`, `ArrowTrap`, `PressureButton`, `HeartPickup`, `ScrapPickup`) and weapon classes (`SawWeapon`, `Chain`) currently violate this boundary by embedding `document.createElement('canvas')`, Canvas 2D `ctx` drawing commands, and DOM `Image` references.
3. **Premise 3**: Observation 1.2 demonstrates that simulation systems (`CombatSystem`, `DroppedSawPush`, `SawDrag`, `PlayerLeash`, `Game._updateGameplay`) directly invoke platform services (`audio.play()`, `particleSystem.trigger*()`, `renderer.triggerShake()`, `window.sessionStorage`).
4. **Premise 4**: Observation 1.3 demonstrates that pure simulation modules (`Physics.js`, `DungeonGraph.js`, `ChainObstacleSystem.js`) already exist in the codebase and demonstrate the viability of pure mathematical modeling without performance penalty.
5. **Deduction 1 (Entity Separation)**: The entity hierarchy must be split into:
   - **Pure Domain State & Logic**: e.g. `PlayerModel` / `PlayerSim`, `EnemyModel` / `EnemySim`, `SawModel` / `SawSim`, containing only numbers, coordinates, timers, and step simulation functions.
   - **View / Renderer Components**: e.g. `PlayerRenderer`, `EnemyRenderer`, `SawRenderer`, containing all `draw(ctx)`, sprite crop calculation, afterimage buffers, canvas tint buffers, and shadow generation.
6. **Deduction 2 (Event-Driven Side Effects)**: In an engine-agnostic simulation, simulation steps must NOT directly call audio or particle systems. Instead, simulation systems must return or push to an `EventBuffer` (e.g. `HitEvent`, `KillEvent`, `DustEvent`, `AudioCueEvent`, `ShakeEvent`).
7. **Deduction 3 (Unity C# Portability Mapping)**:
   - Fixed 60 Hz simulation step (`SIM_HZ = 60`, `dt = 1/60`) maps directly to Unity `FixedUpdate()` with `Time.fixedDeltaTime = 0.0166667f`.
   - The pure domain logic models can be compiled into a standalone .NET Standard / C# class library (`DungeonChained.Core.dll`) with zero references to `UnityEngine`.
   - Unity `MonoBehaviour` views subscribe to or poll simulation models in `Update()`, interpolating positions and triggering Unity Particle Systems, AudioSources, and Cinemachine Impulses.

---

## 3. Caveats

1. **Unity Asset Pipelines**: This survey addresses domain logic, mathematics, state models, and architecture. It does not address asset conversion (PNG sprite sheets, WebAudio WAVs to Unity AudioClips, JSON maps to ScriptableObjects or Unity Tilemaps), which belongs to asset pipeline planning.
2. **Known Test Failure**: `tests/test_modular_grid.js` fails at line 281 due to a known pre-existing issue (#5 in `status.md`). This failure does not impair core simulation extraction.
3. **Double Saw Dormant State**: Double saw mechanics (`split`, `doubleSaw`) remain in `SawWeapon.js` and `test_arauto_double_saw.js`, but are currently excluded from the active forge catalog. The simulation model must preserve the data model to prevent breaking dormant features.

---

## 4. Conclusion & Domain Model Specifications

### 4.1 Target Architectural Boundary

```
+-----------------------------------------------------------------------------------+
|                            PURE SIMULATION DOMAIN                                 |
|         (Zero DOM, Zero Canvas, Zero Audio, Zero Window, Pure 60Hz Math)          |
|                                                                                   |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |    PlayerModel     |  |     TetherModel    |  |          SawModel           |  |
|  | (position, velocity|  | (spring constraint,|  | (spin, rotation, drag, sag, |  |
|  |  dash, fall, lives)|  |  strain, snap, rec)|  |  dropped push, drag tether) |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |     EnemyModel     |  |     CombatSim      |  |         DungeonSim          |  |
|  | (Melee, Golem,     |  | (hitboxes, damage, |  | (DungeonGraph, RoomTiles,   |  |
|  |  Ghostfire, AI FSM)|  |  poise, gibs, drop)|  |  DungeonTileQuery, safeDrop)|  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|                                       |                                           |
|                               emits SimulationEvents                              |
+---------------------------------------+-------------------------------------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
+----------------------------------+        +----------------------------------+
|     WEB ADAPTER (Canvas 2D)      |        |        UNITY C# ADAPTER          |
| - Canvas Entity Renderers        |        | - MonoBehaviour View Controllers |
| - WebAudio AudioManager          |        | - Unity AudioSource / Wwise      |
| - Canvas ParticleSystem          |        | - Unity ParticleSystem / VFX     |
| - DOM / Keyboard InputHandler    |        | - Unity Input System             |
+----------------------------------+        +----------------------------------+
```

### 4.2 Exact Domain Model Specifications (Portable to Unity C#)

#### 1. Math Primitives (`DungeonChained.Core.Math`)
```csharp
public struct Vec2 {
    public float X, Y;
    public Vec2(float x, float y) { X = x; Y = y; }
    public static Vec2 operator +(Vec2 a, Vec2 b) => new Vec2(a.X + b.X, a.Y + b.Y);
    public static Vec2 operator -(Vec2 a, Vec2 b) => new Vec2(a.X - b.X, a.Y - b.Y);
    public static Vec2 operator *(Vec2 a, float s) => new Vec2(a.X * s, a.Y * s);
    public float Length => MathF.Sqrt(X * X + Y * Y);
    public Vec2 Normalized => Length > 0.0001f ? this * (1f / Length) : new Vec2(0, 0);
}

public struct Rect2D {
    public float X, Y, Width, Height;
}
```

#### 2. Player Model (`PlayerModel`)
- **State**:
  - `Position`: `Vec2`
  - `Velocity`: `Vec2`
  - `HitRadius`: `float` (16 px)
  - `BaseSpeed`: `float` (4.2 px/step)
  - `Lives`: `int` (current), `MaxLives`: `int` (3..5)
  - `InvulnerableTimer`: `int` (steps)
  - `HurtTimer`: `int` (steps)
  - `ScaredTimer`: `int` (steps)
  - `SlideTimer`: `int` (steps)
  - `FacingLeft`: `bool`
  - `DashState`: `{ Active: bool, Timer: int, Cooldown: int, Dir: Vec2, LandTimer: int }`
  - `FallState`: `{ Falling: bool, Timer: int, Center: Vec2, Complete: bool }`
- **Simulation Method**:
  ```csharp
  public void Step(Vec2 moveInput, bool dashPressed, bool feetInHole, float speedScale, SimulationContext ctx, EventBuffer events);
  ```

#### 3. Tether & Saw Models (`TetherModel`, `SawModel`)
- **Tether State**:
  - `Connected`: `bool`
  - `Present`: `bool`
  - `Strain`: `int` (0..30)
  - `Cooldown`: `int`
  - `Config`: `{ RestDistance: 130, Stiffness: 0.02, BreakDistance: 240, StrainDistance: 165, StrainLimit: 30, ReconnectDistance: 110, PickupRadius: 60, SnapImpulse: 12 }`
- **Saw State**:
  - `Spin`: `float` (0..1)
  - `Rotation`: `float`
  - `DragOffset`: `Vec2`
  - `Dropped`: `bool`
  - `DropPosition`: `Vec2`
  - `InertiaLeft`: `int`
  - `DroppedVelocity`: `Vec2`
  - `SizeScale`: `float`
  - `DoubleSaw`: `bool`, `SplitRatio`: `float`
- **Simulation Method**:
  ```csharp
  public void Step(PlayerModel p1, PlayerModel p2, SpatialQuery query, EventBuffer events);
  public Vec2 GetCablePoint(PlayerModel p1, PlayerModel p2, float t);
  public SawDisc[] GetSawPositions(PlayerModel p1, PlayerModel p2);
  ```

#### 4. Combat Simulation (`CombatSim`)
- **Hit Detection Pipeline**:
  ```csharp
  public void ResolveWeaponHits(SawModel saw, List<EnemyModel> enemies, PlayerModel p1, PlayerModel p2, bool connected, EventBuffer events);
  public void ResolveEnemyAttacks(List<EnemyModel> enemies, PlayerModel[] players, EventBuffer events);
  public void ResolveLooseSawHits(SawModel saw, List<EnemyModel> enemies, EventBuffer events);
  ```
- **Events Emitted**:
  ```csharp
  public struct HitEvent {
      public int TargetId;
      public int Damage;
      public Vec2 Position;
      public Vec2 Direction;
      public HitTier Tier; // Hit, PoiseBreak, Kill
      public float HitStopDuration;
  }
  public struct AudioEvent {
      public string Cue;
      public float Volume;
      public float Pitch;
  }
  public struct CameraShakeEvent {
      public float Intensity;
  }
  ```

#### 5. Enemy Models (`EnemyModel`, `MeleeEnemyModel`, `FlameGolemBossModel`)
- **State Machine**:
  - `AIState`: `Chase | Windup | Attack | Recover | Hurt | Stunned | Dying | Dead`
  - `Hp`: `int`, `Poise`: `float`
  - `StateTimer`: `int`
  - `TargetPlayerId`: `int`
  - `Path`: `List<Vec2>` (from 4-dir BFS tile grid)
- **Boss Specific Extensions**:
  - `Phase`: `int` (1 or 2)
  - `Abilities`: Melee, AoESlam, LeapSlam, ChargeDash
  - `CollisionBodies`: Articulated ellipses for torso + arms

#### 6. Dungeon Simulation (`DungeonSim`, `RoomSim`, `TileQuerySim`)
- **State**:
  - `Grid`: 2D `int[,]` tile values (`-1 = hole`, `-2 = void`, `16 = floor`, `walls = wall indices`)
  - `WallBoxes`: `List<Rect2D>`
  - `HoleEdgeMargin`: 20 px
  - `HolePushback`: Inward damping & pushback impulse
  - `SafeDropPoints`: BFS flood fill algorithm from player coordinates

### 4.3 Phased Refactoring Strategy Recommendations

1. **Phase 1: Pure Math & Domain Model Extraction**
   - Extract `Physics.js`, `DungeonGraph.js`, `DungeonTileQuery.js` into a dedicated `js/sim/` folder.
   - Define formal TypeScript/ESM interfaces for `Vec2`, `Rect2D`, `PlayerInput`, and `SimulationEvents`.
2. **Phase 2: Entity & Weapon Model/View Decoupling**
   - Extract `PlayerModel.js` (pure sim) from `Player.js`; create `PlayerRenderer.js` for canvas rendering.
   - Extract `SawModel.js` and `TetherModel.js` from `SawWeapon.js` and `Chain.js`; create `SawRenderer.js` and `CableRenderer.js`.
   - Extract `EnemyModel.js` and boss state machines from `MeleeEnemy.js`, `FlameGolemEnemy.js`, and `GhostfireBoss.js`; create `EnemyRenderer.js`.
3. **Phase 3: Event-Driven Simulation Loop Extraction**
   - Create `GameSimulation.js` that houses the 17-step update pipeline from `Game._updateGameplay`.
   - `GameSimulation.step(inputs, dt)` returns `SimulationEvents` queue.
   - `Game.js` acts purely as the presentation shell: feeds inputs, steps simulation, and dispatches events to `AudioManager`, `ParticleSystem`, `Renderer`, and `VtuberHud`.
4. **Phase 4: Dead Code Elimination & Optimization**
   - Eliminate verified dead code: `MeleeEnemy` dead state, unused `Chain.applyToEnemies`, `Weapon.hitsTarget`, unused `_flashCanvas` references, and redundant collision sweeps.
5. **Phase 5: Unity C# Port Validation**
   - Verify that all files in `js/sim/` have 1:1 direct translation to C# without engine dependencies.

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run the automated test runner to ensure no regression against the baseline:
```bash
npm test
```
- Baseline expectation: 44 passed, 1 pre-existing known failure (`test_modular_grid.js`).
- Individual simulation feature verification commands:
  - `npm test -- safe_spawn`
  - `npm test -- player_dash`
  - `npm test -- player_spawns`
  - `npm test -- hole_resistance`
  - `npm test -- combat_feel`
  - `npm test -- flame_golem_abilities`
  - `npm test -- arauto_das_brasas`
  - `npm test -- chain_obstacles`
  - `npm test -- saw_upgrades`
  - `npm test -- saw_drag`
  - `npm test -- ghostfire`

### 5.2 Map Integrity Gate
Run the map piece validation script:
```bash
npm run validate:map
```
- Baseline expectation: Passes with known pre-existing unlisted piece (`corridor_vertical_ns_1.json`).

### 5.3 Invalidation Conditions
The conclusions of this report would be invalidated if:
1. Core simulation mechanics (player movement, chain constraint, saw collision, enemy AI BFS) require continuous synchronous readbacks from the Canvas 2D context or DOM tree. (Verified: all simulation logic operates on numeric world-space coordinates and tile matrices; Canvas readbacks do not exist).
2. The fixed 60 Hz step cannot be executed in isolation from `requestAnimationFrame`. (Verified: `GameLoop` isolates `onStep(SIM_STEP)` in a deterministic accumulator loop separate from `onRender`).
