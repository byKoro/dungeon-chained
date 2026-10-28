# Boss gate opening — v4

Created 2026-10-27. Drawn pixel by pixel by a deterministic script: `.agents/tasks/2026-10-27-boss-gate-redesign/gen_boss_gate_v4.py` (run from the repo root). No image generation; replaces v1 for the game.

File: `boss-gate-opening-sheet-v4.png`, 96×96 RGBA at native art scale. Four 48×48 frames in a 2×2 grid, row-major: closed, raised 11 px, raised 22 px, fully open. In game `DemoDoors` draws one frame at 3×3 tiles (4 world px per art px).

All 23 colours come from `assets/tileset/tileset.png` (plum stone, brown trim, rust iron, gold rivets, bone skull, red keystone gem). The stone ring is identical in all frames; only the portcullis and skull lock rise behind the lintel. The passage opening is 32 art px (two tiles) wide, centred.

Status: integrated in `js/core/AssetLoader.js` as `bossGate`. Checked at native scale against tileset tiles in an offline composite; not yet observed in the running game.
