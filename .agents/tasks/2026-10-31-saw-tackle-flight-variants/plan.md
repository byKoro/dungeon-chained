# Saw tackle flight variants

Status: done
Branch: feat/tackle-serra (existing feature work preserved)  Base: 08edbd2  Date: 2026-10-31

## Goal
Keep the original return trajectory for comparative playtests and add a mode that continues its path and decelerates after cumulative travel distance, selectable in Editor 2.0.

## Context read
AGENTS.md; architecture.md; conventions.md; systems/rendering.md, weapons.md, room-editor.md; status.md; glossary.md; ADR 0003; backlog/tackle-serra.md; router, diagnosing-bugs and code-review skills.
Graphify unavailable; used context docs and scoped searches.

## Steps
- [x] Add a failing regression for forward travel after enemy release.
- [x] Add configurable coast trajectory, cumulative distance and friction in SawTackle and SawTackleConfig.
- [x] Wire Editor 2.0 selector through playtest session into Game constructor.
- [x] Test distance threshold, wall bounces, slowing across enemy attachment, Arauto surface and renewed tackle.
- [x] Review Standards and Spec with two independent agents.
- [x] Run focused tests, general gate and hidden Electron integration test; update docs.
