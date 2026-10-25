# Project notes: input-systems in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

InputHandler maps keyboard + gamepads to lowercase key names; P1 wasd, P2 arrows, gamepad 0/1 -> same names (js/core/InputHandler.js, controls in EntityConfig.playerConfigs). Menu pad input is separate (Game._pollMenuPad). No rebinding UI yet; if added, persist in localStorage like MasterVolume. See .agents/context/systems/players-and-chain.md.
