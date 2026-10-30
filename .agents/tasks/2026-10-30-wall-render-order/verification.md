# Verification

## Commands
- `npm test`: 42/43; only `test_modular_grid.js` fails (known #5).
- `npm run validate:map`: only `corridor_vertical_ns_1.json` unlisted (known #4).

## Electron (`python serve.py` + `npx electron _local/verify-walls.cjs`, map `inicial.json` via Editor 2.0 playtest)
Players placed and pushed by script, camera fixed with `demoCamera.focus`. Captures in `_local/verify-walls/v3/`. No console errors.
- Bottom ledge (row 18): players stop at y 17.75 tiles and draw behind the ledge. In v2 they stood on top of it.
- South border: players draw behind the last row. In v2 they were hidden under the two repainted floor rows.
- Upper wall (row 9): players reach y 10.05 tiles (10.25 before the climb) and overlap the wall face.
- Stake (3,10): a player north of it is covered by the stake.
- Injected `box_1` and `flamethrower_v`: a player north of the box is covered at the feet; south of it draws in front.

## Not verified
- Enemies against front walls (sorted by `footY`).
- Real keyboard/pad input, split mode (F6), classic maps, packaged build.
