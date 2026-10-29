# Verification — Ghostfire fiel ao trailer

## Automated
- [x] `npm.cmd test -- ghostfire` — pass.
- [x] `npm.cmd run check` — all 12 test files pass; docs drift check passes. Overall gate still fails solely on pre-existing map issue #4: `map/corridor_vertical_ns_1.json` is absent from `map/index.json`. No unrelated map edits made.
- [x] Twenty independent randomized Ghostfire test runs — pass; checks safe spawn placement and type coverage under varying candidates.
- [x] All five Ghostfire audio cues reference existing trailer files.
- [x] `git diff --check` — pass.
- [x] `npm.cmd run graph` attempted — graphify is not installed; setup via `npm run doctor` / requirements-dev.txt. Context docs + rg used instead.

## Browser integration (headless Chrome, local fixture)

- [x] Real Game/AssetLoader/RoomCatalog via `http://127.0.0.1:8765/_local/ghostfire/preview.html`; no production bootstrap changes.
- [x] Visually inspected firing from both sides and the warning: full skull, original muzzle flames, pixel-art strip/tail, side flip, glow/light and health bar.
- [x] Stepped 1,800 gameplay ticks through Game._updateGameplay: all ten attack states observed on both sides, max six living minions, no game over (players had invulnerability for this smoke test), no thrown exceptions.
- [x] Stepped 60 more ticks after death: boss and minions removed. With the fixture's combat lock, the room clears normally.
- Screenshots: `_local/ghostfire/beam-right.png`, `beam-left.png`, `warning-left.png`, `death-end.png` (gitignored).
- The first sandboxed Chrome launch failed to initialize the GPU process; approved execution outside the sandbox succeeded.

## Not verified

- Human-controlled combat balance and audible sound mix; browser automation validated the rendered scene and simulation, not subjective difficulty/audio.
- Electron desktop packaging.
- Automatic procedural boss-room placement: there is still no authored boss room (existing status #2). Use the editor's Ghostfire enemy entry in an authored room/playtest.

## Focused commit verification before push

- Only the Ghostfire implementation/support is staged. Pre-existing FireSkull work, cleanup, the generic ghostfire sprite-height tweak and the RoomArchetypes change remain local. Shared files were staged with only boss hunks; their remaining working contents were preserved.
- Exported the exact index sources to `_local/ghostfire-commit-check` and ran `npm.cmd run check` there. Ghostfire passes; 10/11 test files pass. The only test failure is the documented baseline Curva SE assertion in `test_modular_grid.js` (status #5); that file and RoomArchetypes are unchanged in this commit. The map index issue #4 also remains. No new failures.
- The earlier 12/12 result applies to the full local working tree, which includes the user's separate RoomArchetypes fix and FireSkull test.
- `git diff --cached --check` passes. The staged SpawnSystem imports only committed classes, and original optional audio cues/exports remain intact.
