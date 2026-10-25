# Project notes: game-ai in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Enemies: MeleeEnemy state machine chase/windup/attack/recover/dying with 4-dir BFS navigation (_chaseWaypoint). Known bug: wall blocks ignored by navigation (status.md #8). PlayerAI (js/systems/PlayerAI.js) is a debug bot for P1 (toggle I). No behavior-tree runtime; keep FSMs simple unless an ADR adds one.
