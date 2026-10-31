# Dispatch: Worker M3 — Ports & Adapters Web Integration

## Assignment
Execute Milestone 3 according to `PROJECT.md` and `ARCHITECTURE_PROPOSAL.md`:

1. **Implement Platform Adapters in `js/adapters/`**:
   - `js/adapters/WebInputAdapter.js`:
     Implements `IInputProvider`. Reads DOM keydown/keyup events and polls `navigator.getGamepads()`. Populates `InputSnapshot`:
     `{ players: [{ moveX, moveY, dash, interact }, { moveX, moveY, dash, interact }], menu: { up, down, left, right, confirm, cancel, pause }, dt }`.
   - `js/adapters/AudioEventAdapter.js`:
     Consumes `SimulationEvents` queue. Dispatches domain events (`SawSnapped`, `SawReconnected`, `SawHit`, `EntityDamaged`, `EntityDied`, `PlayerFootstep`, `PlayerFell`, `PlayerDashed`) to `AudioManager` (`play()`, `duck()`, `sawMotor`).
   - `js/adapters/JuiceEventAdapter.js`:
     Consumes `SimulationEvents` queue. Dispatches camera shake (`Renderer.triggerShake`), zoom punch (`Renderer.triggerZoomPunch`), screen gore (`ScreenGore.triggerFlash`), and particle bursts (`ParticleSystem`).
   - `js/adapters/CanvasViewRenderer.js`:
     Implements the decoupled Canvas 2D presentation layer. Consumes `RenderSnapshot` from `GameSimulation` and renders the simulation elements (players, cable curve, saw rotation/teeth, enemies, pickups, traps) with proper `feetSortY` depth sorting, preservation of crisp pixel art (`imageSmoothingEnabled = false`), and coordinate projection.

2. **Adapt `js/Game.js` to Orchestrate via Ports & Adapters**:
   - Wire `Game.js` to coordinate `GameSimulation` in `_step` using `WebInputAdapter`, flushing simulation events to `AudioEventAdapter` and `JuiceEventAdapter`.
   - In `_renderView`, utilize `CanvasViewRenderer` (or adapter hooks) to render simulation state while maintaining all existing overlays, HUD, lighting, and camera behavior.
   - Maintain 100% functional gameplay preservation (Requirement R5): dual-player tether/saw physics, combat balance, audio cues, transitions, and editor features must remain completely working.
   - Address minor review finding: add defensive fallback in `GameSimulation.step`: `const input = inputSnapshot || {};` and safe access for players.

3. **Verification**:
   - Write unit test `tests/test_ports_and_adapters.js` testing input snapshot transformation, event dispatch mapping, and snapshot projection.
   - Run `node tests/test_simulation_core.js` and `node tests/test_ports_and_adapters.js`.
   - Run `npm test` across all test files to verify zero regressions.
   - Run `npm run validate:map` to verify 0 errors.
   - Run `node --check` across all new files in `js/adapters/` and `js/Game.js`.

## Mandatory Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Output your report to: `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\worker_m3\handoff.md`
Notify the orchestrator via `send_message` when complete.
