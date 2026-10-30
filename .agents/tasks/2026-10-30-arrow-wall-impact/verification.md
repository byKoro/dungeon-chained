# Verification
node tests/test_arrow_wall_impact.js failed before fix (arrow tunneled through wall), passes after fix.
Coverage: all directions, long movement segment, shielding behind wall, dead-arrow immobility, mounting-wall exit, one-step queue, configured spark emission, Room perimeter/internal wall injection.
npm run check: 45/46 suites pass; prior modular-grid assertion and unlisted corridor_vertical_ns_1.json failures remain. Docs drift passes.
npm run graph: graphify unavailable (run npm run doctor).
No browser/game visual observation.
