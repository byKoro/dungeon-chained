# Project notes: procedural-gen in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Generation = DungeonGraph.generate (scatter + Prim MST + carved corridors) then RoomCatalog.pick of an authored piece per cell by door signature (ADR 0004). Seeded per cell via RoomManager._cellRng(gx, gy, floor, runSeed). Prop scatter: scatterPropsOnFloor in GameConfig. Keep authored content authored; randomness chooses pieces, not tiles.
