# Project notes: create-game-assets in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Art spec: pixel art, 16 px per tile (TILE=64 world px, art pixel = 4 world px), tileset sheet 10 columns of 16 px (js/core/Tileset.js). Enemy sheets: 100 px grid cells, one animation per row (schema in .agents/context/systems/combat-and-entities.md). Player expressions: assets/player_0N/expressions/<name>.png. Place files under assets/<group>/ and register in js/core/AssetLoader.js. Keep provenance (source/license) next to the asset or in the PR. scripts/asset_report.py needs Python + requirements.txt in this skill folder.
