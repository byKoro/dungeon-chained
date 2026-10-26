# Verification — gamepad ui

## Automated
- [x] `tests/test_menu_pad.js`: 15/15.
- [x] `node --check` on every changed JS file.
- [x] `npm run check`: only pre-existing `status.md` #4 and #5 fail.

## Manual (headless Chrome, scripted fake pad via a temporary harness page, removed afterwards)
- [x] Gate → A → trailer; SKIP after ~3 s.
- [x] Start → trailer pause (focus RESUME); ↓ → volume; ← held 1 s → 0.7 → 0.1 in repeated steps; B → resume.
- [x] A → SKIP → game.
- [x] Game: Start → pause; ↓↓ → volume; → held → 0.1 → 0.5; B → resume.
- [x] Audio blocked (`resume()` never resolves): pad at gate → trailer muted after 300 ms; START at ~130 s; Start → game; Start held 7 s into the game did not pause it.
- [x] Death screen: B does nothing; A restarts (lives back to 3).
- [x] No page errors.

## Not verified
- A real controller (Xbox/PlayStation) or the browser's real Gamepad API mapping; the fake pad used the standard mapping.
- Electron with `autoplayPolicy` (not launched).
- Sound output.
