# Boss gate opening — v5

Created 2026-10-27. Drawn pixel by pixel by `.agents/tasks/2026-10-27-boss-gate-redesign/gen_boss_gate_v5.py` (run from the repo root). No image generation. Replaces v4 in the game.

File: `boss-gate-opening-strip-v5.png`, 128×32 RGBA at native art scale. Four 32×32 frames in one row, left to right: closed, raised 7 px, raised 13 px, fully open.

Placement: `DemoDoors` draws one frame at 2×2 tiles, x = the two door columns, y from one tile above the room to the bottom of the north wall row. The bottom half copies the brick rows of wall tile 1 from `assets/tileset/tileset.png`, so the wall continues into the gate pillars. The top half is an arched crown in the same bricks and brown cap, with a red gem on the keystone. Only the portcullis and skull lock move.

Colours: all from `tileset.png`.

Status: checked at native scale in an offline composite with tiles 0–5, 10, 15 and 16; not yet observed in the running game.
