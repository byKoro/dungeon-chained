# Project notes: physics-tuning in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Custom physics in js/core/Physics.js (static): chain spring applyChainConstraint, ellipse entity collisions, circle (saw) and box (walls) resolution, 3 iterations per step in Game._updateGameplay. Fixed timestep (ADR 0005), no interpolation. Chain parameters are hard-coded in the Game constructor (status.md #11). See .agents/context/systems/players-and-chain.md.
