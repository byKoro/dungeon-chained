# Boss gate opening — v6

Created 2026-10-27. Drawn pixel by pixel by `.agents/tasks/2026-10-27-boss-gate-redesign/gen_boss_gate_v6.py` (run from the repo root). No image generation. Replaces v5 in the game.

File: `boss-gate-opening-strip-v6.png`, 128×32 RGBA at native art scale. Four 32×32 frames in one row, left to right: closed, raised 7 px, raised 13 px, fully open.

Placement: `DemoDoors` draws one frame at 2×2 tiles over the two door columns, from one tile above the room down to the bottom of the north wall row.

2.5D top-down look, same convention as the tileset walls (brown top surface above a darker brick front face):
- rows 0–7: top surface of the gate, brown slabs with plum rims and a lighter front lip, raised keystone in the middle;
- rows 8–19: front face above the wall line, lintel with a red gem and pillar bricks;
- rows 20–31: the wall row itself, copied from wall tile 1, so the wall's brick courses run into the gate pillars.

Colours: all from `assets/tileset/tileset.png`. Only the portcullis and skull lock move.

Status: checked at native scale in an offline composite with tiles 0–5, 10, 15 and 16; not yet observed in the running game.
