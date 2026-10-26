# restore trailer

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: fix/restore-trailer  Base: 19a6979  Date: 2026-10-26

## Goal
Bring back the opening trailer (gate "click or press any key" → trailer → START, SKIP at any time) that `9b13c52` deleted as dead code. Only the boot trailer: not `trailer.html`, `b3.html`, `matchcut.html`, nor `js/trailer/b3|matchcut`.

## Context read
- `.agents/context/systems/ui.md`, `architecture.md`, `playbooks/port-old-branch.md`, ADR 0002
- `git show 9b13c52~1:js/main.js`, `index.html`, `css/style.css`, `js/trailer/TrailerPlayer.js`
- Module closure of `js/trailer/TrailerPlayer.js` at `9b13c52~1`: 30 files under `js/trailer/` + `js/ui/SpeechBubble.js` (deleted).
- Game modules the trailer imports differ from `9b13c52~1` only in comments (comment-stripped diff), except `GRID_COLS` 9→3 (unrelated).
- Assets the closure loads that were deleted: `assets/audio/trailer/*` (38), `assets/audio/music/megasong.mp3`, `assets/keyart/logo.png`, `assets/fx/explosion.png`.

## Steps
- [x] 1. Restore trailer closure + `SpeechBubble.js` + assets from `9b13c52~1`; strip comments to match `9b13c52` style.
      Files: `js/trailer/**`, `js/ui/SpeechBubble.js`, `assets/...`
      Verify: `node --check` on each file.
- [x] 2. Overlay markup/CSS (`#trailer-overlay`, `.tr-skip`, `.tr-start`, `#trailer-pause`).
      Files: `index.html`, `css/style.css`
- [x] 3. SKIP/START UI as its own class (ADR 0002) and boot wiring.
      Files: `js/ui/TrailerOverlay.js`, `js/main.js`
      Verify: browser at `/`, `/?skipTrailer`, `/?playtest=true`.
- [x] 4. `npm test`, `npm run validate:map`, `npm run check`.

## Docs to update when done
- [x] `.agents/context/systems/ui.md`, `architecture.md` (boot / screens)
- [x] `.agents/context/status.md`
- [x] ADR: not structural (restores previous behaviour)
