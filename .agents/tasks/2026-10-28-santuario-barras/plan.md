# Sanctuary cinematic bars
Date: 2026-10-28. Branch: feat/cinematic-bars. Base: main at task start.
Goal: preserve sanctuary decisions and implement reusable bars in the existing trailer. Room construction excluded.
Read: AGENTS, router, game-ui-ux and PROJECT-NOTES, architecture, conventions, rendering, ui, status, glossary, ADRs 0001-0010, code-review.
Completed: inspect static bars and framing; extract CinematicBars with config; update TrailerStage/TrailerPlayer; await exit in bootstrap; test timing, geometry and trailer integration; review standards/spec.
Proposal: 0.18 s exit tuning. Confirmed: 0.4 s entry and 10% height per bar.
Future Game integration belongs in _step/_render; no cutscene director introduced.
Graphify unavailable. Visual validation outstanding.
