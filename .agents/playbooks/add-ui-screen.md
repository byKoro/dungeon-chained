# Playbook: add a UI screen

Context: `.agents/context/systems/ui.md`. Template to copy: `js/ui/DeathScreen.js` (single button) or `js/ui/PauseScreen.js` (list + slider + focus nav).

## Steps
1. **Root markup** in `index.html` (next to `#death-screen`). This avoids a flash before JS runs:
   ```html
   <!-- Tela de vitória (js/ui/VictoryScreen.js) -->
   <div id="victory-screen" role="dialog" aria-label="Victory" aria-hidden="true">
       <div class="victory-menu"></div>
   </div>
   ```
   Also implement a `_createRoot()` fallback in JS, like both existing screens.
2. **CSS** in `css/style.css`: copy the `#death-screen` / `.pause-screen` blocks. The root is hidden by default, `.visible` shows it, controls pop in with a `transform: scale(0)` → animation keyed on `.visible`, and there is a `prefers-reduced-motion` override. Size with `var(--px)`.
3. **Class** `js/ui/VictoryScreen.js`:
   - Build controls with `new PixelButton(el, { label: 'NEXT', ariaLabel: 'Next', face: 'gold', minTextW, enabled: () => this.visible, onPress })`. `el` is a `<button>` containing a `<canvas>`. Align widths with `minTextW = Math.max(...labels.map(measureText))`.
   - For a value control, use `new PixelSlider(div, { get, set, enabled })`.
   - Text/art: draw with `drawText`/`measureText` from `PixelFont.js` into small canvases at 1 art-px, then scale by `pixelScale()`.
   - `show()`: `reset()` controls, add `.visible`, set `aria-hidden="false"`, focus the first control with `{ preventScroll: true }` (delay it to match the CSS pop-in if needed, like `DeathScreen`'s 400 ms).
   - `hide()`: remove `.visible`, set `aria-hidden="true"`, blur the controls.
   - `_applyScale()` on construct and on `resize`: `applyScale(pixelScale())` for each control + `root.style.setProperty('--px', ...)`.
   - With several controls, provide `move(±1)`/`confirm()` like `PauseScreen` (focus-driven, wraps around).
4. **Sounds.** `PixelButton` already plays `uiMove` on focus change and `uiConfirm` on click. Opening and closing should call `playUi('uiOpen'|'uiClose')` from `js/ui/UiSound.js`. New UI cues follow `.agents/playbooks/add-sound.md`, and also add the name to `UI_CUES` in `UiSound.js` so the standalone fallback includes it.
5. **Wire in `js/Game.js`:**
   - import and construct in the constructor (next to `deathScreen`/`pauseScreen`), passing callbacks (`onNext: () => this.…`).
   - show and hide at the state transition (e.g. where `gameOver`/`deathScreen.show()` is handled). Hide it in `newDungeon()`.
   - freeze gameplay if needed: `_step` early-returns on `gameOver`. Add a similar flag, or use `gameLoop.setPaused`.
   - keyboard: extend `_bindButtons` if the screen needs global keys. Do not double-handle Enter when the button is focused (see the `deathScreen.button` check).
   - gamepad: add a branch in `_pollMenuPad` that routes `hit("a")`, `hit("up"/"down")`, and `hit("b")` to the screen while it is visible, before the pause branch.
6. **HUD instead of a screen?** Non-interactive overlays (banners, counters) belong on canvas: draw them in `Game._renderOverlays` after `hud.draw` or inside `VtuberHud.draw`, with the transform reset to identity and integer scales.

## Verify
- `python serve.py` → http://localhost:8000 (or `npm start`).
- Test with mouse (hover = focus, click), keyboard (Tab, arrows, Enter/Space, Escape), and a gamepad (A/B/D-pad/Start). Resize the window and check that the art stays crisp at integer scale.
- Devtools: no console errors. `aria-hidden` toggles correctly. Focus does not land on hidden controls (they are gated by `enabled: () => this.visible`).
- Reduced motion: emulate `prefers-reduced-motion` in devtools Rendering.

## Done checklist
- [ ] Root in `index.html` + `_createRoot` fallback. CSS `.visible` + reduced-motion.
- [ ] Controls gated by `visible`. Focus set on show and cleared on hide.
- [ ] Keyboard, mouse, and gamepad all work. Sounds play once (no double confirm).
- [ ] Hidden on `newDungeon()`/restart.
- [ ] `.agents/context/systems/ui.md` updated (files table, data flow, input section).
