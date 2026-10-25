# Project notes: performance-optimization in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Profile with Chrome/Electron DevTools (F12 in Electron). Hot spots to know: BloodCanvas is world-sized (2688x4032) offscreen canvas, PostProcessor light map per frame, particle pools compacted by updateAndCompact, MAX_ACTIVE_GIBS cap. Fixed 60 Hz sim with MAX_SIM_STEPS_PER_FRAME cap (ADR 0005).
