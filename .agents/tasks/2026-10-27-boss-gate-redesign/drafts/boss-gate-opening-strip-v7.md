# Boss gate opening — v7

Created 2026-10-27. Drawn pixel by pixel by `.agents/tasks/2026-10-27-boss-gate-redesign/gen_boss_gate_v7.py` (run from the repo root). No image generation. Replaces v6 in the game.

File: `boss-gate-opening-strip-v7.png`, 128×32 RGBA at native art scale. Four 32×32 frames in one row, left to right: closed, raised 7 px, raised 13 px, fully open.

Placement: `DemoDoors` draws one frame at 2×2 tiles over the two door columns, from one tile above the room down to the bottom of the north wall row.

2.5D top-down look, same convention as wall tile 1:
- rows 0–7: top surface, two wide brown slabs plus a raised keystone, `#4c2f49` rim, `#78514f` front lip with no border line between the lip and the front face;
- rows 8–19: front face, bricks 3 px tall separated by `#3d253b` rows like the wall face, wide lintel bricks, red gem under the keystone, `#4c2f49` outer contour;
- rows 20–31: the wall row itself, copied from wall tile 1.

Colours: 20, all from `assets/tileset/tileset.png`. The passage is a single flat `#050304`. Only the portcullis and skull lock move.

Status: checked at native scale in an offline composite with tiles 0–5, 10, 15 and 16; not yet observed in the running game.
