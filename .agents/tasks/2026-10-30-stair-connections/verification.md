# Verification
node tests/test_stair_connections.js passed (placement, duplicates, normalize, resize, validate, destination, radius, safe arrival).
node tests/test_editor2_transparent_tiles.js passed.
npm run check: 44/45 suites passed; existing modular-grid failure and unlisted corridor_vertical_ns_1.json remain.
npm run graph: unavailable, graphify missing. Run npm run doctor.
Browser/game not opened; visual and manual travel not observed.

Border follow-up: four-edge placement, floor opening, validation, arrival and resize regressions pass. npm run check still has only the two pre-existing failures (44/45 suites). npm run graph remains unavailable.
