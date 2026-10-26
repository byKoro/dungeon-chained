# Verification — restore trailer

## Automated
- [x] `node --check` on every restored file, `js/main.js` and `js/ui/TrailerOverlay.js`: OK.
- [x] Comment strip is code-preserving: whitespace-free code of each restored file equals `9b13c52~1` with comments removed, using a second independent stripper (31/31 files identical).
- [x] `npm run check`: fails only on pre-existing `status.md` #4 (`corridor_vertical_ns_1.json` not in index) and #5 (`test_modular_grid` Curva SE). 4/5 test files pass, same as `main`.

## Manual (python serve.py → http://localhost:8000, headless Chrome)
- [x] `/`: loading → gate (logo + "CLICK OR PRESS ANY KEY") → key → IntroScene with speech bubble; SKIP appears after ~3 s.
- [x] SKIP click → "Preparing the dungeon…" → game with HUD.
- [x] Full run with `?timer`: 12 scenes, START visible at ~126 s (BossWallShot), Enter → game.
- [x] Esc during the trailer → `#trailer-pause` (RESUME + volume) above SKIP.
- [x] `/?skipTrailer` → straight to the game.
- [x] No page errors. Only 404s: `tileset_2..6.png` (pre-existing #15) and `favicon.ico`.

## Not verified
- Audio output (headless run, sound not heard).
- Gamepad input in the trailer.
- Electron build (`npm start` / `npm run dist`); `electron/main.cjs` is unchanged from before the removal.
- `?playtest=true` from the editor (same code path as `?skipTrailer`).
