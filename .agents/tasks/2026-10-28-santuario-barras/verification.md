# Verification
node tests/test_cinematic_bars.js: passed timing, interruption, screen coordinates, proportional height, TrailerPlayer entry, paused tick and awaited exit.
node --check js/trailer/TrailerStage.js: passed.
npm.cmd run check: 18/19 tests passed; pre-existing modular-grid test failure and unlisted map piece remain (#4/#5).
npm.cmd run graph: graphify unavailable; run npm run doctor.
No live game/browser visual validation performed: skip/pause devices, all aspect ratios and scene framing remain unobserved. Sanctuary remains planned.
