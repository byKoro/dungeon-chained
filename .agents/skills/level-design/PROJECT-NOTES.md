# Project notes: level-design in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Levels = room pieces (14x9 tiles) built in editor.html (python serve.py). Player metrics: speed 4.2 px/step, chain rest 130 px, break 240 px, TILE 64. Door openings 2 tiles wide at fixed positions; keep spawn tiles clear (PLAYER_DOOR_SPAWN_TILES). Co-op constraint: both players are tethered, so gaps/holes wider than the chain break distance force a snap. Playbook: .agents/playbooks/add-room-piece.md.
