# Project notes: roguelike in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Not turn-based: real-time fixed-step co-op. Relevant parts: procedural dungeon graph (js/core/DungeonGraph.js), permadeath per run (game over when either player hits 0 lives, Game.restart), room clear/lock rules (js/rooms/Room.js). Grid/FOV/turn sections do not apply. Read .agents/context/systems/rooms-and-maps.md first; known limitation: GRID_COLS=3 yields a fixed linear layout (status.md #1).
