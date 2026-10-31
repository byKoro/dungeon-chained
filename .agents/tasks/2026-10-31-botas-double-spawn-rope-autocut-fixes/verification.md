# Verification — botas double-spawn / double camera / rope auto-cut + landing sound

Date: 2026-10-31

## Commands
- `node --check` on all modified js → OK.
- `npm test` → 61/63. Only pre-existing failures: `test_arauto_effects` (committed showMarks flag), `test_modular_grid` (#5).
- New `tests/test_zone_assign.js` → 9/9. `tests/test_room_events.js` → 26/26 (unchanged).
- `npm run validate:map` → only the pre-existing #4 (unlisted corridor piece).

## Electron run (real game, botas room, temp harness since deleted) — 0 console errors
Teleported to botas (0,1), chain connected, both players held inside the "combate" zone, then stepped the sim; then swept the pair across the room.
- `maxEnemiesAtOnce`: 6 (was 12 before the dedupe) — enemies spawn once.
- `cameraDiveStarts`: 1 (was 2) — single camera dive.
- `cutsAfterEntryHold`: 0 — no rope cuts just from entering the zone (the forced-auto-cut is gone for Editor 2.0 stakes).
- `ropesCutDuringSweep`: 1 — a rope cuts only when the connected saw actually crosses a stake (intended mechanic).
- inicial (Salão) still auto-cuts: it authors `auto` at (16,15) and uses `drops`, so the authored auto still starts it.

## What was NOT verified
- No human playtest of the feel: the landing-thud loudness/pitch (`sawTackleLand` is a reused placeholder cue), and whether the single camera dive and the combat pacing feel right.
- Only the botas room was exercised live; penhasco (same no-auto authoring) was reasoned about (same code path) but not run.
- The sweep test drove the saw deliberately across a stake; I did not exhaustively test every stake position for accidental grazing during normal co-op movement.
