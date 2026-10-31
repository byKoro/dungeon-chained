# Verification — saw tackle flight variants

## Automated
- Before implementation: `node tests/test_saw_tackle.js` failed at the new forward-path assertion: saw curves toward origin after releasing an enemy.
- After implementation: same command passes. Original return tests remain; added coast tests cover forward path with a stationary player ahead, distance threshold, continued deceleration, speed preserved across enemy hits, accumulated bounce distance, safe landing, Arauto solid body and renewed impulse.
- Hidden Electron harness: both selector values pass through actual Editor 2.0 button, sessionStorage, DemoMapLoader and Game.sawTackle. No uncaught renderer errors observed. This is an automated integration check, not manual gameplay.
- `npm run check`: 51/54 test files pass. Failures outside this change: test_arauto_effects.js:43 (telegraph.showMarks), test_flame_golem.js:50 (chase vs windup), test_modular_grid.js (Curva SE). Map gate: corridor_vertical_ns_1.json absent from map/index.json. No changes made to these systems to clear the gate.
- `git diff --check`: passes.
- `npm run graph`: graphify unavailable; reports install instruction. Run `npm run doctor` to inspect the environment.

## Not verified
Manual co-op gameplay, actual orbiting scenario with moving entities, final tuning/feel and packaged build. No claim of having observed the reported orbit in the running game; the regression exercises the return curvature after enemy release.

Cleanup for commit: temporary runtime scripts/screenshots archived in _local/tackle-unused/.agents/tasks/2026-10-31-saw-tackle-flight-variants/ (ignored by Git). Historical results above retained.
