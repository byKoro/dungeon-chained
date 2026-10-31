# Verification

## Regression
Before fix: new unsafe-stop assertion failed: _land moved (204.8,236.8) to (96,224) immediately.
After fix: position remains unchanged when requesting landing; subsequent updates travel at most landingSpeed until safe arrival.

## Tests
- `npm test -- saw_tackle`: 2/2 files pass. Landing tests cover exact safe position/render preservation, hole/unreachable fallback, bounded travel, wall detour, fully blocked passage waiting then reopening, near-hole fallback when preferred targets blocked, reconnection and new-tackle interruption.
- `npm test -- hole`: 3/3 pass.
- `npm test -- player_dash`: 1/1 pass.
- `git diff --check`: passes (line-ending notices only).
- Final `npm run check`: 52/55 files pass. Failures outside changed logic: test_arauto_effects.js, test_golem_solid_body.js:55 (chase vs windup), test_modular_grid.js (Curva SE); unlisted corridor_vertical_ns_1.json still fails map validation. Earlier run also showed test_arauto_das_brasas.js:34 chase vs windup; that test passed in final run.
- `npm run graph`: graphify unavailable. npm run doctor diagnoses environment setup.

## Electron runtime
Hidden offscreen Electron, actual Editor 2.0 session map with hole at (6,3), actual Game + tile queries + injected route and collision callbacks. Simulation paused for deterministic subsystem stepping. Initial position (396.8,236.8) unchanged on landing request; 28 updates to (288,224), max per-step movement 4.000000000000019 px (floating-point tolerance), final state null and position safe. dropT remained 1. No uncaught renderer errors observed. Script retained as verify-runtime.cjs.

## Limits
No manual co-op feel test or packaged build. If every route to reachable floor is closed, saw remains in landing, retries every 15 steps, and accepts a new tackle or reconnection. No teleport fallback. Existing return/coast options and boss-launch behavior remain.

Cleanup for commit: temporary runtime scripts/screenshots archived in _local/tackle-unused/.agents/tasks/2026-10-31-saw-safe-landing-route/ (ignored by Git). Historical results above retained.

Final cleanup verification: independent Standards and Spec reviews found no actionable issues. npm run check: 52/55 passed; test_arauto_effects, test_flame_golem (chase/windup) and test_modular_grid failed; corridor_vertical_ns_1.json remains unlisted. Both tackle test files passed. git diff --check passed. Confirmed all archived assets unreferenced by js/tests and ignored by Git. Both editor versions retained; no new runtime behavior added by cleanup.
