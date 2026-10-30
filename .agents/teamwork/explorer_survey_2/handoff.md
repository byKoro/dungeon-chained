# Explorer Survey 2: Platform, Rendering, Audio, Input & Lifecycle Handoff Report

## Executive Summary
This survey provides an exhaustive architectural mapping of all platform, rendering, audio, input, game loop, and editor subsystems in *Dungeon Chained* (`js/`). We identify six fundamental coupling patterns that link the pure game simulation to Web platform primitives (DOM, Canvas 2D, `HTMLImageElement`, Web Audio `AudioContext`, and `localStorage`). Finally, we specify a clean **Ports & Adapters (Hexagonal Architecture)** design that decouples pure simulation from the platform view layer, ensuring the web version remains fully playable while creating an identical seam for a future Unity C# engine port.

---

## 1. Observation

### 1.1 Complete Inventory of Platform / View / IO Features

#### A. Canvas 2D Rendering Pipeline & Camera
- **`js/core/Renderer.js`**:
  - **Camera & Coordinate Quantization**:
    - Lines 54–60 (`_quantizeZoom`): Quantizes zoom so tile size corresponds to integer screen pixels (`Math.max(1, Math.round(t * zoom)) / t`) to eliminate subpixel seam artifacts.
    - Lines 66–95 (`updateCamera`): Lerps position (0.12) and zoom (0.08) toward target + drone sway offset.
    - Lines 37–44 (`applyDroneSway`): Spring physics simulation for camera lag based on player velocities (`CAMERA_DRONE.stiffness`, `CAMERA_DRONE.damping`).
    - Lines 62–64, 115–121: Screen shake max-merging with exponential decay (`shake * 0.88`).
    - Lines 28–30, 123–126: Zoom punch with decay (`punch * 0.82`).
    - Lines 111–136 (`beginFrame` / `endFrame`): Clears canvas (`clearRect`), sets world matrix via `ctx.setTransform(renderZoom, 0, 0, renderZoom, tx, ty)` with shake offset.
    - Lines 138–148 (`beginOverlayWorld` / `endOverlayWorld`): Re-applies world transform without shake/punch for unlit floating elements (hearts, scrap overlay, damage numbers).
    - Lines 97–109 (`screenToWorld`, `worldToScreen`): Forward and inverse coordinate projection between world coordinates and screen pixels.
  - **Scene Drawing Routines**:
    - Lines 171–183 (`drawBackground`): Loops through visible world viewport and tiles background texture (`BACKGROUND_TILE` 78).
    - Lines 185–285 (`drawRoom`): Renders floor tiles (including auto-tiled holes via `holeTileFor`), walls, tile props (with horizontal flipping), animated torches (4-frame cycle computed from `performance.now() / 160`), and closed door tiles.
    - Lines 291–318 (`drawDoorStubs`): Extends hallway stub tiles through open door portals.
    - Lines 322–342 (`wallDrawables`): Generates depth-sortable drawable descriptors for interior walls (`feetSortY` set to tile midpoint) to allow players to step behind or in front of walls.
    - Lines 344–376 (`drawFrontWall`): Redraws bottom wall row over characters walking behind the south wall.
    - Lines 378–421 (`_drawDoorGradients`): Linear gradients creating atmospheric darkness within door thresholds.
    - Lines 150–165 (`drawRoundShadow`): Radial gradient shadows (`rgba(0, 0, 0, 0.65)` -> `0.35` -> `0`) with walk bounce modulation.
- **`js/core/Tileset.js`**:
  - Lines 1–19: Wraps `HTMLImageElement` with 16px tile slicing across 10 columns, invoking `ctx.drawImage`.
- **`js/systems/DemoCamera.js`**:
  - Lines 4–62: Multi-mode camera controller:
    - Mode `'zoom'`: dynamically scales zoom to keep both players within view plus `DEMO.cameraMargin`.
    - Mode `'fixed'`: clamps framing, renders offscreen indicators (`drawIndicators`) when players exit screen bounds.
    - Mode `'split'`: `renderSplit()` partitions canvas into two viewports (left/right 50%), clips via `ctx.rect` and sets `renderer.viewport`, rendering world from P1 and P2 viewpoints independently.
    - Cinematic override: `focus = { x, y, zoom }` overrides normal player tracking.
- **`js/systems/LightingRenderer.js` & `js/systems/PostProcessor.js`**:
  - `LightingRenderer.js` (lines 74–250): Translates world light sources (players, active blade, dropped blade, torches, hearts, door beams, enemy embers) to screen coordinates (`renderer.worldToScreen`) and feeds them to `PostProcessor`.
  - `PostProcessor.js` (lines 17–23, 71–100): Manages two offscreen canvases (`_lightCanvas`, `_loCanvas`) for low-res blocky pixel lighting (`globalCompositeOperation = 'lighter'`). Blends light map over ambient darkness (`41, 35, 53`) onto main canvas via multiply, and draws vignette (`setVignetteBreath` pulsing with cable strain).
- **`js/particles/BloodCanvas.js`**:
  - Lines 8–23: Allocates world-sized offscreen canvas (`WORLD_W` 2688 × `WORLD_H` 4032, `BLOOD_PIXEL` 4).
  - Lines 51–174: Performs permanent stamping of footprints, splats, and pools with `multiply` blend mode.
  - Lines 30–47: Maintains `this.zones = []` and evaluates spatial query `isBloodZone(x, y)`.
- **`js/systems/ScreenGore.js`**:
  - Lines 22–98: Full-screen damage flash pulse (`#8a0f1a`) and particle simulation of 4–7 edge-spawned blood droplets.

#### B. Audio Pipeline & Bus Architecture
- **`js/core/AudioManager.js`**:
  - Lines 212–246 (`_ensureContext`, `_unlockOnGesture`): Lazy initialization of Web Audio `AudioContext` on user interaction (`pointerdown`, `keydown`, `touchstart`).
  - Lines 221–227: Routing graph:
    `LoopVoice (or _loops)` -> `_duckNode (GainNode)` -> `_preNode (GainNode)` -> `_masterNode (GainNode)` -> `ctx.destination`.
  - Lines 248–275 (`createStreamTap`, `_routeToGraph`): Creates `MediaStreamDestination` for audio recording and routes cloned HTMLAudioElements into `_sfxBus`.
  - Lines 142–206 (`play`): Handles one-shot sound effects via `HTMLAudioElement.cloneNode()`, manages cooldowns (`cooldownMs`), voice stealing (`maxVoices`), variant alternation (`_lastVariant`), rate jitter (`rateVariance`), and pitch shift (`preservesPitch = false`).
  - Lines 313–367 (`playLoop`, `stopLoop`): Web Audio streaming loops (`fetch` + `decodeAudioData` into `AudioBufferSourceNode`) with fallback to HTML5 `<audio loop>`.
  - Lines 404–420 (`duck`): Dynamic sidechain ducking of the ambience loop node with attack, hold, and release envelopes.
- **`js/core/LoopVoice.js`**:
  - Lines 1–123: Parameter-driven continuous Web Audio voice: `BiquadFilterNode` (lowpass cutoff 18kHz down to min), `pulseGain`, `levelGain`, detune oscillator (`pulse()`).
- **`js/weapons/SawWeapon.js` & `SawMotorAudio.js`**:
  - `SawMotorAudio.js`: Pure mathematical mapping (`motorTargets(spin, state)`) driving a `LoopVoice`. Responds to spin speed, chain connection, hit stops, and time scale.
- **`js/systems/ArautoAudio.js`**:
  - Continuous dual-saw and boss stone grinding audio synthesis, charge dash wind loop, and ground slam feedback.
- **`js/core/MasterVolume.js`**:
  - Lines 1–41: Global volume singleton backed by `localStorage.getItem('dungeonChained.masterVolume')`, quadratic perceptual curve (`gain = v²`).
- **`js/ui/UiSound.js`**:
  - Routes UI navigation and button confirm audio cues (`uiMove`, `uiConfirm`, `uiOpen`, `uiClose`).

#### C. Input Pipeline & Device Mapping
- **`js/core/InputHandler.js`**:
  - Lines 30–55: DOM event listeners on `window` for `"keydown"`, `"keyup"`, `"blur"`, `"gamepadconnected"`, `"gamepaddisconnected"`.
  - Lines 1–5, 22–25: Two-player split controls:
    - P1: Keys `w`, `a`, `s`, `d`, Space (dash), `e` (interact).
    - P2: Keys `arrowup`, `arrowdown`, `arrowleft`, `arrowright`, Enter (dash), `shiftright` (interact).
  - Lines 58–88 (`pollGamepads`): Evaluates `navigator.getGamepads()` each frame:
    - Gamepad 0 maps to P1; Gamepad 1 maps to P2.
    - Analog stick with `deadZone = 0.35` (axes 0 and 1).
    - D-pad buttons 12–15.
    - Dash mapped to buttons 0 (A / Cross) and 5 (RB / R1).
    - Interact mapped to button 2 (X / Square).
  - Lines 8–10, 90–99: Device detection (`padKind` detects PlayStation via `054c` vendor ID vs Xbox), tracking which controller type each player is using.
- **`js/core/MenuPad.js`**:
  - Lines 8–67: Gamepad polling for UI menus:
    - Aggregates any connected controller.
    - Threshold: analog stick |axis| > 0.6.
    - Auto-repeat timer: 350 ms initial delay, 110 ms repeat cadence.
    - Latching: buttons already held on initial poll are suppressed to prevent input bleeding between scenes.

#### D. UI & DOM Overlays
- **`js/ui/VtuberHud.js`**:
  - Lines 32–100, 509–580: Screen-space Canvas HUD:
    - Two animated player bust portraits with spring dynamics (squash, hop, push, lean, sink) and expression sequencing (`PLAYER_EXPRESSIONS`).
    - Allocated offscreen canvas per portrait (`document.createElement('canvas')`).
    - Heart rows with sprite breakdown and debris animations.
    - Dash charge segment meter (`DashBar`).
- **DOM Screen Overlays (`index.html`, `css/style.css`, `js/ui/*`)**:
  - `#loading-screen` (`LoadingScreen.js`): Canvas progress bar with animated segments.
  - `#pause-screen` (`PauseScreen.js`): Interactive DOM overlay hosting canvas-rendered `PixelButton` and `PixelSlider` elements.
  - `#death-screen` (`DeathScreen.js`): Interactive DOM overlay hosting single RESTART button.
  - `TrailerOverlay.js`: Opening trailer DOM overlay for SKIP and START buttons.
- **In-Game Canvas Overlays**:
  - `BossHealthBar.js`, `ScrapCounter.js`, `DialogueSystem.js` (`SpeechBubble.js`), `ForgeMenu.js`, `InteractPrompt.js`, `Letterbox.js`, `HoldToSkip.js`, `DemoVictory.js`.

#### E. Game Lifecycle (`Game.js`, `GameLoop.js`, `main.js`)
- **`js/main.js`**:
  - Lines 9–69 (`bootstrap`): Bootstraps DOM elements (`gameCanvas`), `LoadingScreen`, `AssetLoader`, `RoomCatalog`, `TrailerPlayer`, and transitions into `Game`.
- **`js/core/GameLoop.js`**:
  - Lines 21–120: Fixed-step loop driven by `requestAnimationFrame`:
    - `onFrameStart()` runs once per render frame.
    - Fixed step accumulation: `frameSeconds * timeScale` accumulated in `_simAccumulator`.
    - Dispatches N steps: `while (_simAccumulator >= SIM_STEP) onStep(SIM_STEP)`. Clamped to `MAX_SIM_STEPS_PER_FRAME`.
    - Dispatches one render: `onRender()`.
    - Handles hit-stop freeze (`triggerHitStop`, freezing simulation while rendering continues) and slow-mo ease curve (`triggerHitSlowmo`).
- **`js/Game.js`**:
  - Lines 87–351: Central monolithic orchestrator constructing 38 subsystems.
  - Lines 934–955 (`_step`): State machine dispatching to `_updateSawCinematic`, `_updateTransition`, `_updateRoomIntro`, `_updateArautoIntro`, `arautoScene`, or `_updateGameplay`.
  - Lines 1370–1386 (`_render`): View rendering dispatch (`_renderView` -> `_renderOverlays`).

#### F. Room & Map Editors
- **`js/editor/EditorApp.js` (Editor 1.0)**:
  - 2,461 lines. DOM sidebar cards (`editor.html`), interactive tile canvas, local storage persistence, HTTP communication with dev server `serve.py` (`POST /api/save-room`, `POST /api/delete-room`), and playtest launch via `sessionStorage["editor_custom_room"]` + `?playtest=true`.
- **`js/editor2/MapEditorApp.js` (Editor 2.0)**:
  - 1,298 lines. Authors demo maps (`editor2.html`). Tools for tiles, collision kinds, doors, animated props, chest scrap, anvil recipes, room encounters. HTTP communication via `/api/save-map` and playtest launch via `sessionStorage["editor2_playtest_map"]`.

---

### 1.2 Direct Couplings to Simulation Entities (Verified Locations)

1. **Entity `draw(ctx)` Methods**:
   - `Player.js` (lines 412–480): `Player.draw(ctx)` directly executes Canvas 2D matrix transformations (`ctx.translate`, `ctx.rotate`, `ctx.scale`), alpha blending, and `ctx.drawImage`.
   - `Player.js` (lines 367–382): Allocates a DOM offscreen canvas inside the entity:
     ```js
     if (!this._tintBuf) this._tintBuf = document.createElement('canvas');
     ```
   - `MeleeEnemy.js` (lines 10–40, 520–600): Allocates module-level DOM canvases `tintBuf` and `silhouetteBuf` via `document.createElement('canvas')`, performing direct 2D image operations during drawing.
   - `SawWeapon.js` (lines 58–60, 309–350, 480–520): Combines physics calculations with `ctx.drawImage`, `ctx.stroke()`, and allocates offscreen canvas `this._flashCanvas = document.createElement("canvas")`.
   - `SpikeTrap.js` (lines 73–112): `SpikeTrap.draw(ctx)` draws spike geometry and checks `img.complete && img.naturalWidth > 0`.
   - `ArrowTrap.js` / `Arrow` (lines 43–60): `Arrow.draw(ctx)` executes Canvas 2D transforms and strokes.
   - `HeartPickup.js` (lines 20–35): Mixes collection logic with `draw(ctx)` and `drawShadow(ctx)`.

2. **Entity Direct Ownership of Browser Image Assets**:
   - `Player.js` (line 5): Constructor receives `spriteImg` (`HTMLImageElement`).
   - `MeleeEnemy.js` (line 43): Constructor receives `sheet` (`HTMLImageElement`).
   - `SawWeapon.js` (lines 46–49): Constructor receives `sprite` and `cableSprite` (`HTMLImageElement`).
   - `HeartPickup.js` (line 119 in `Game.js`): Uses static `HeartPickup.sheet = this.assets.get("heartPickup")`.

3. **Simulation Logic Querying View/Render Buffers**:
   - `Game.js` (line 1122–1124): Pure gameplay update queries `BloodCanvas`:
     ```js
     const bc = this.particleSystem.bloodCanvas;
     const overBlood = !!bc && bc.isBloodZone(sawX, sawY);
     weapon.setOnBlood?.(overBlood);
     ```
   - `ParticleEffects.js` (line 70): Gameplay footprint update checks:
     ```js
     if (this.bloodCanvas.isBloodZone(x, y)) player.bloodStepsLeft = BLOOD_STEPS;
     ```

4. **Simulation Systems Directly Invoking Audio & Camera Feedback**:
   - `CombatSystem.js` (lines 13–22, 54–81, 100–250): Receives `renderer`, `audio`, `particleSystem`, `arautoAudio`, and directly invokes:
     `this.renderer.triggerShake(...)`
     `this.audio.play(...)`
     `this.audio.duck(...)`
     `this.particleSystem.triggerBlood(...)`
   - `ParticleEffects.js` (lines 60–67): Directly calls `this.audio.play("playerStep")` and modifies player simulation state `player.footstepSoundCooldown`.
   - `Game.js` (lines 1070–1085, 1195–1200, 1240–1248, 1260–1267): Directly triggers `this.audio.play("sawSnap")`, `this.audio.play("playerFall")`, `this.audio.play("playerHit")`, `this.audio.play("doorOpen")`, `this.renderer.triggerShake(14)`, `this.renderer.triggerZoomPunch(-0.07)`.

5. **Simulation Directly Reading Raw DOM Input Handlers**:
   - `Player.js` (lines 130–170): `update(input, bounds)` directly receives `InputHandler` and calls `input.isDown(key)` with keyboard string identifiers ("w", "s", "a", "d", " ", "enter").
   - `ChestSystem.js`, `ForgeSystem.js`, `DemoProgress.js`: Directly read raw `input` instances to detect interaction presses.

---

## 2. Logic Chain

1. **Premise 1**: The project requires extracting pure game simulation logic (movement, physics, cable/saw mechanics, combat, entity AI, procedural room placement) into engine-agnostic modules with zero DOM, Canvas 2D, or browser global references, so they can be ported directly to Unity C# (Requirements R2, R3).
2. **Premise 2**: Currently, entities (`Player`, `MeleeEnemy`, `SawWeapon`, `SpikeTrap`, `ArrowTrap`) directly implement `draw(ctx)`, instantiate offscreen DOM canvases (`document.createElement('canvas')`), and hold references to `HTMLImageElement` objects (Observations 1.2.1, 1.2.2).
3. **Premise 3**: Currently, pure gameplay updates query render buffer structures (`bloodCanvas.isBloodZone`) to alter weapon and player simulation states (Observation 1.2.3).
4. **Premise 4**: Currently, combat resolution and entity updates directly invoke platform audio (`audio.play`, `audio.duck`) and camera shake (`renderer.triggerShake`) (Observation 1.2.4).
5. **Premise 5**: Currently, entities and gameplay systems directly consume browser DOM input objects (`InputHandler.isDown`) with hardcoded string key names (Observation 1.2.5).
6. **Inference**: Therefore, to achieve complete portability without breaking the existing playable web Canvas game, the system must establish an architectural boundary based on **Ports & Adapters (Hexagonal Architecture)**:
   - Entities must be stripped of `draw(ctx)`, image assets, and input polling.
   - Simulation must consume a generic `InputSnapshot` structure provided by an input adapter.
   - Simulation must emit typed `DomainEvents` (or buffer one-frame events) consumed by audio and visual juice adapters.
   - Simulation must expose read-only state snapshots consumed by dedicated view renderers.
   - Spatial blood zone data must be maintained in a pure mathematical simulation grid/spatial index, and mirrored to `BloodCanvas` purely for visual stamping.

---

## 3. Caveats

1. **Unity Asset Parity**: In JavaScript, sprites are sliced at runtime from raw sprite sheets using pixel coordinates and crops. In Unity, sprites are typically authored as `Sprite` assets in the Sprite Editor with Pixels Per Unit (PPU) settings. The proposed adapter interface abstracts this by referencing sprite IDs, frame indices, and animation states rather than raw pixel source rects.
2. **Audio Timing & Pitch Mechanics**: Web Audio one-shots clone `<audio>` elements or use `AudioBufferSourceNode`, while Unity uses `AudioSource` pools and AudioMixer snapshots. The pitch-scaling formulas (e.g. `HIT_COMBO_PITCH_STEP`, `SawMotorAudio.motorTargets`) must be implemented identically across both platforms.
3. **Pre-Existing Test Failure**: Test `tests/test_modular_grid.js` fails on the baseline (`Curva SE` assert) due to a known pre-existing issue documented in `status.md` (#5). 44 out of 45 tests pass.

---

## 4. Conclusion & Proposed Architecture

### 4.1 Boundary Specification (The Seam)

```
                 +---------------------------------------+
                 |          PURE SIMULATION LAYER        |
                 |  - Entity Positions, Velocities, State|
                 |  - Cable / Saw Math & Physics         |
                 |  - Combat Resolution & Health         |
                 |  - Room Graph & Tile Collisions       |
                 |  - Pure Fixed 60Hz Step (SIM_STEP)   |
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
|  - Web: InputHandler    |                     |  - Web: AudioManager    |
|  - Unity: Input System  |                     |  - Unity: AudioSource   |
+-------------------------+                     +-------------------------+
                                     |
                                     v
                        [ ISimulationSnapshot / View ]
                                     |
                        +------------+------------+
                        |  Platform Render Adapter|
                        |  - Web: Canvas 2D View  |
                        |  - Unity: 2D URP View   |
                        +-------------------------+
```

### 4.2 Core Interfaces and Data Contracts

#### A. Input Adapter Boundary
```typescript
interface PlayerInput {
    moveX: number;       // -1.0 to 1.0 (clamped / normalized)
    moveY: number;       // -1.0 to 1.0
    dash: boolean;       // Edge-triggered dash button
    interact: boolean;   // Held / pressed interact button
}

interface InputSnapshot {
    players: [PlayerInput, PlayerInput];
    menu: {
        up: boolean; down: boolean; left: boolean; right: boolean;
        confirm: boolean; cancel: boolean; pause: boolean;
    };
    rawDeltaTime: number;
}
```
*Web Implementation*: `WebInputAdapter` reads DOM `keydown`/`keyup` and polls `navigator.getGamepads()`, populating `InputSnapshot` each frame.
*Unity Implementation*: `UnityInputAdapter` reads `UnityEngine.InputSystem.Gamepad` / `Keyboard` and populates the identical struct.

#### B. Event Bus Boundary (Audio & Screen Juice)
Simulation no longer calls `audio.play()` or `renderer.triggerShake()`. Instead, simulation enqueues lightweight event structs into `SimulationEventQueue`:
```typescript
type SimulationEvent =
    | { type: 'SawSnapped'; x: number; y: number; discRadius: number }
    | { type: 'SawReconnected' }
    | { type: 'SawHit'; hitCount: number; heavy: boolean; x: number; y: number }
    | { type: 'EntityDamaged'; entityId: string; damage: number; x: number; y: number; isPlayer: boolean; remainingLives: number }
    | { type: 'EntityDied'; entityId: string; enemyType: string; x: number; y: number; effectMaterial?: string }
    | { type: 'PlayerFootstep'; playerIndex: number; x: number; y: number; angle: number; inBlood: boolean }
    | { type: 'PlayerFell'; playerIndex: number; x: number; y: number }
    | { type: 'PlayerDashed'; playerIndex: number; dirX: number; dirY: number }
    | { type: 'DoorUnlocked'; doorDir: string }
    | { type: 'RoomCleared' }
    | { type: 'ChestOpened'; x: number; y: number; scrapCount: number }
    | { type: 'ScrapCollected'; count: number; streak: number }
    | { type: 'SawMotorState'; spinSpeed: number; connected: boolean; active: boolean };
```
*Web Audio Adapter*:
- Subscribes to events at the end of each simulation step.
- Maps `SawSnapped` -> `audio.play("sawSnap")` + `audio.duck(-9)`.
- Maps `SawHit` -> `_playSawHit(hitCount, heavy)`.
- Maps `PlayerFootstep` -> `audio.play("playerStep")`.
- Maps `SawMotorState` -> `sawMotor.update(spinSpeed, state)`.
*Web Juice Adapter*:
- Maps `SawSnapped` -> `renderer.triggerShake(14)` + `particleSystem.triggerSparkBurst()`.
- Maps `EntityDamaged` -> `screenGore.triggerFlash()` + `renderer.triggerShake()`.

#### C. View Rendering Boundary (State Snapshots)
Instead of entities having `draw(ctx)` methods, the simulation exposes read-only data queries or an immutable snapshot:
```typescript
interface EntityRenderState {
    id: string;
    type: 'player' | 'enemy' | 'saw' | 'trap' | 'pickup' | 'prop';
    subType: string;         // 'demon', 'bloodMonster', 'spike', 'arrow', etc.
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    facingLeft: boolean;
    animState: string;       // 'idle', 'walk', 'hurt', 'scared', 'attack'
    animFrame: number;
    invulnerable: boolean;
    isFalling: boolean;
    fallProgress: number;
    dashScale: number;
    feetSortY: number;
}

interface ChainRenderState {
    connected: boolean;
    hasSaw: boolean;
    p1Pos: { x: number; y: number };
    p2Pos: { x: number; y: number };
    cablePoints: Array<{ x: number; y: number }>;
    sawPositions: Array<{ x: number; y: number; radius: number; rotation: number }>;
    strain: number;
    dropped: boolean;
    dropPos?: { x: number; y: number };
}

interface RoomRenderState {
    cellRect: { x: number; y: number; w: number; h: number };
    arenaBounds: { minX: number; maxX: number; minY: number; maxY: number };
    tiles: RoomTileData;
    doors: Array<{ dir: string; open: boolean; x: number; y: number }>;
    lightSources: Array<LightSourceData>;
}

interface SimulationFrameSnapshot {
    room: RoomRenderState;
    chain: ChainRenderState;
    entities: Array<EntityRenderState>;
    events: Array<SimulationEvent>;
}
```
*Web Canvas 2D View Adapter*:
- Implements `CanvasViewRenderer`: iterates `entities`, resolves sprites from `AssetLoader`, sorts by `feetSortY`, and executes Canvas 2D draw calls.
- Preserves the exact verified draw order from `Game._render()` (background -> room -> stubs -> floor particles -> shadows -> cable -> sorted entities / saw -> front wall -> air particles -> lighting -> HUD).
*Unity C# View Adapter*:
- Unity `GameViewManager` reads the snapshot: updates positions on `GameObject` / `Transform` instances, sets `Animator` state parameters, updates `LineRenderer` for the cable, adjusts 2D URP light parameters, and triggers Unity particle systems.

---

## 5. Verification Method

1. **Automated Test Suite**:
   ```powershell
   npm test
   ```
   *Verification criterion*: 44 of 45 test files pass (with only the pre-existing `test_modular_grid.js` known bug #5 failing). Zero regressions.
2. **Syntax Validation**:
   ```powershell
   node --check js/Game.js
   node --check js/core/Renderer.js
   node --check js/core/AudioManager.js
   node --check js/core/InputHandler.js
   ```
   *Verification criterion*: All modules pass Node.js syntax check without errors.
3. **Full Quality Gate Verification**:
   ```powershell
   npm run check
   ```
   *Verification criterion*: Matches baseline status in `status.md`.
4. **Handoff Artifact Inspection**:
   - `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_2\handoff.md` contains the complete survey.
   - `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_2\progress.md` reflects completed investigation status.
   - `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_2\BRIEFING.md` reflects updated state and decisions.
