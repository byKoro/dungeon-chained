# Tests as standalone node scripts

Status: accepted

Tests in `tests/` are plain ESM scripts with a hand-rolled assert that exit non-zero on failure; `npm test` runs them all. No Jest/Vitest, consistent with ADR 0001 (no npm runtime deps, no build). Only pure logic is unit-tested; browser-only behaviour (canvas, Audio, DOM) is verified manually in the running game.
