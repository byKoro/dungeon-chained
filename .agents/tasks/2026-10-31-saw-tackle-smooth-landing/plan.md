# Smooth saw tackle landing

Status: done
Branch: feat/tackle-serra (existing work preserved)
Date: 2026-10-31

## Goal
Remove the position and visual pop when the tackled saw stops, retaining safe fallback for holes and unreachable ground.

## Context read
AGENTS.md; router, diagnosing-bugs and code-review skills; architecture, conventions, weapons, rendering, rooms-and-maps and status context from this chat. Scoped reads: SawWeapon, SawTackle, DungeonTileQuery, Chain and Game update order. Graphify unavailable.

## Steps
- [x] Capture failing test of actual safeDropPoint + SawTackle._land + drawDropped seam.
- [x] Preserve already safe coordinates in DungeonTileQuery.safeDropPoint.
- [x] Remove landing dropT reset in SawTackle.
- [x] Verify focused tests, safety fallbacks, general gate, and runtime Electron integration.
- [x] Independent Standards and Spec review; update system/status docs.
