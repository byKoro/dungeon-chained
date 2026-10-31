# Boss launches loose saw

Status: done
Date: 2026-10-31
Branch: feat/tackle-serra (existing dirty feature work preserved)

## Goal
Add Arauto dash and attack1 launches of the loose saw alongside existing attack2/slam launches.

## Context
AGENTS.md; router; architecture, conventions, weapons, combat-and-entities; FlameGolemEnemy attack/charge lifecycle, Game enemy update order, SawTackle and prior tests. Graphify unavailable; used scoped search.

## Steps
- [x] Confirm only attack2 and slam currently launch.
- [x] Handle attack1 impact using configured range and dash swept contact using configured hitRadius.
- [x] Reuse existing boss launch flight, forward direction for dash, radial for impacts.
- [x] Test warning/range/sweep/walls/active and connected saw guards, plus real boss entity execution.
- [x] Run focused tests, check, graph attempt, independent Standards and Spec reviews, update docs.
