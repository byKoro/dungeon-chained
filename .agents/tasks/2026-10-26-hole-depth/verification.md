# Verification — hole depth

## Automated
- [x] npm run check (see final run in the PR): only the pre-existing failures #4 (map index) and #5 (test_modular_grid).
- [x] npm test -- hole_effects: sources, motes only inside holes, `maxMotes` cap, fall clip geometry, one burst per fall, drawFalling save→clip→draw→restore + brightness filter, room change clears.
- [x] npm run assets:report on both sheets: PASS 160x192 RGBA. Pixel diff vs HEAD: only hole cells 100..107, 109..116.

## In-game (headless Chrome, static `python -m http.server --bind 127.0.0.1`, `?playtest=true` with the room in sessionStorage)
- [x] ingame-room.png: new hole tiles in `corridor_horizontal_ew_1` under real lighting/vignette at 1600x900. No page errors (only the known tileset_2..6 404s, #15).
- [x] ingame-fall.png: temporary harness forced `p1.startFalling` every 1.1 s; frames show the body clipped at the south rim, darkened, crumbs around it, then the existing respawn flash.
- [x] ingame-edge-crumbs.png: P2 pinned at a pit's west edge drops pebbles down the face.

## Inner corners
- [x] npm test -- hole_tiles: 47 valid masks, unique indices, legacy 16 unchanged, both sheets (160x256) contain every index, T / inverted-T masks.
- [x] corners-before-after.png: synthetic room (T, inverted T, U, rings, zigzag) with the 4-neighbour mapping (left) vs blob mapping (right).
- [x] User's in-game screenshot of an inverted T shows the column rims continuing down the face ends.
- [x] Fix (user report): north inner-corner top pixel was lip colour, so the face lip ran 1 art px past the floor edge into the side rim line. Now rim colour; corners-fixed.png (U, cross, inverted T, both palettes).
- [x] Second report ("still cuts one pixel in"): the column's rim line kept running down beside the arm faces, slicing 1 px off their ends. North corner cells now continue the face (lip + courses, same 8 px brick bond) one pixel under the rim line; the line stops at the lip. Only cells 120..129, 134..137, 142..145, 148..150 changed. corners-flush.png: headless in-game crop, before (top) / after (bottom).

## Not verified
- Ambient dust motion and overall feel at 60 fps (only stills captured; dust is faint in unlit areas by design, tune `HOLE_FX.dust.alpha/lipRate`).
- tileset_1 palette in game (`T`), the editor holes tab, Electron build.
- A real walk-in fall with input (harness forced the fall state).
- Interaction with the in-progress dash work (`feat/player-dash`, same working tree): dashing over a pit spawns edge crumbs; not reviewed further.
