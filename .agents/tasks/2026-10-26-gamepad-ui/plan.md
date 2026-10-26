# gamepad ui

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/gamepad-ui  Base: 4932b03  Date: 2026-10-26

## Goal
Every UI screen fully usable with a console pad: trailer gate, SKIP, START, trailer pause, game pause (with hold-to-repeat), death screen.

## Context read
- `systems/ui.md`, `architecture.md`, `players-and-chain.md` (input), ADR 0002/0003
- `Game._pollMenuPad`, `TrailerPlayer._pollPad/_showGate`, `TrailerOverlay`, `PauseScreen`, `electron/main.cjs`
- Chromium issue 463233716: a pad button is not a user activation, so it can't unlock WebAudio in a browser.

## Steps
- [x] 1. `MenuPad` (edges, first-poll latch, hold-to-repeat, `any`) + `MENU_PAD` config. Files: `js/core/MenuPad.js`, `js/config/GameConfig.js`. Verify: `tests/test_menu_pad.js`.
- [x] 2. `Game._pollMenuPad` on `MenuPad`. Files: `js/Game.js`.
- [x] 3. Trailer: pad at gate (muted fallback), `onPadAction` → `TrailerOverlay.padAction` (A = SKIP/START, Start = START at the end). Files: `js/trailer/TrailerPlayer.js`, `js/ui/TrailerOverlay.js`, `js/main.js`.
- [x] 4. Electron `autoplayPolicy` explicit. Files: `electron/main.cjs`.

## Docs to update when done
- [x] `systems/ui.md`, `architecture.md`, `players-and-chain.md`
- [x] `status.md` #19
- [x] ADR: not structural
