# UI

## Purpose
Pixel-art UI in two layers:
- **DOM overlays** over `#gameCanvas`: loading, pause, and death screens built from canvas-rendered `PixelButton`/`PixelSlider`. These are focusable real `<button>`/`role=slider` elements.
- **Canvas HUD** (`VtuberHud`), drawn in screen space at the end of `Game._renderOverlays`: animated player portraits ("vtuber" busts with expressions) and heart rows.

## Files
| File | Role |
|---|---|
| `index.html` | static roots `#death-screen` (with `.death-btn`), `#pause-screen > .pause-menu`, `#loading-screen > canvas.ls-bar` |
| `css/style.css` | `.visible` / `.ls-hidden` toggles, pop-in animations, `--px` scale var, `.pixel-btn:focus-visible`, reduced-motion rules |
| `js/ui/PixelFont.js` | 5-px bitmap font: `drawText(ctx,text,x,y,color,maxChars)`, `measureText`, `wrapText`, `LINE_HEIGHT`=10; pt-BR accents composed; unknown char → `?` |
| `js/ui/PixelButton.js` | `PixelButton` class, `renderPixelButton`, `drawStoneFrame`, `controlSize`, `pixelScale()`, palettes `FRAME`, `FACES` (`red`/`gold`/`stone`) |
| `js/ui/PixelSlider.js` | `PixelSlider` (volume), `renderPixelSlider` |
| `js/ui/PauseScreen.js` | RESUME / RESTART / volume slider; focus navigation |
| `js/ui/DeathScreen.js` | single RESTART button |
| `js/ui/LoadingScreen.js` | segmented progress bar; `run(text, tasks)` |
| `js/ui/TrailerOverlay.js` | SKIP (gold, after 3 s) / START (red, at trailer end) over the opening trailer |
| `js/ui/SpeechBubble.js` | `renderSpeechBubble` (trailer dialogue bubbles) |
| `js/trailer/` | opening trailer: `TrailerPlayer` (scene list, gate, pause, pad), `TrailerStage`, `scenes/`, `kit/`, `fx/`, `audio/TrailerAudio.js` |
| `js/ui/VtuberHud.js` | `VtuberHud`, internal `Portrait`, `HeartRow`, `Spring` |
| `js/ui/UiSound.js` | `playUi(cue)` (see audio.md) |

## Key types & APIs
- `PixelButton(el, { label, ariaLabel, face, minTextW, enabled: () => bool, onPress })`: `refresh()`, `reset()`, `showPressed()`, `applyScale(s)`. States: `idle`/`hover` (= focused)/`pressed`. On click: if `enabled()`, plays `uiConfirm` and calls `onPress`.
- `PixelSlider(el, { ariaLabel, get, set, minTextW, enabled })`: `step(delta)`, `refresh(force)`, `reset()`, `applyScale(s)`. Keys ←/→/A/D (±0.1), Home/End, wheel ±0.05, pointer drag. Ticks `uiMove` with rate following the value, throttled to 55 ms.
- `PauseScreen({ onResume, onRestart?, onMove?, rootId='pause-screen', volume=true, restartLabel })`: `show()`, `hide()`, `visible`, `move(±1)`, `confirm()`, `adjust(±1)`, `focusedIndex`, `items` (= buttons + slider). The slider binds to `MasterVolume` (`get: MasterVolume.value`, `set: MasterVolume.set`).
- `DeathScreen({ onRestart, label })`: `show()` (focuses button after 400 ms, matching the CSS pop-in), `hide()`, `button`.
- `LoadingScreen({ delayMs=150, minVisibleMs=450 })`: `run(text, [{ weight, task: async (report01) => … }])`, `show`, `setProgress(0..1)`, `hide()`. Task errors are only `console.warn`ed.
- `VtuberHud({ assets, getPlayers, spriteConfigs, colors })`: `draw(ctx, W, H)`, `onRoomEnter(combat)`, `onRoomCleared()`, `setPaused(b)`, `reset()`.
  - `Portrait` reactions: `hurt()`, `partnerHurt()`, `healed()`, `roomEnter(combat, delay)`, `roomCleared(delay)`, `setPaused(p, delay)`. It plays expression sequences `[{ expr | look, dur, lean? }]` and uses `Spring`s (`squash`, `hop`, `push`, `lean`, `sink`), blinking, and idle glances.
  - Expressions (pt-BR file names): `PLAYER_EXPRESSIONS` in `js/core/AssetLoader.js`, loaded as `player_0N_expr_<name>` from `assets/player_0N/expressions/<name>.png`. A missing image falls back to the walk sheet.
  - `HeartRow`: hearts break into halves (debris) on loss, pop in on gain, heartbeat when at 1 life. Sprite `assets/heart/heart.png` frames FULL/EMPTY/HALF_L/HALF_R (16 px).
  - `DashBar`: a mini loading bar (same art language as `LoadingScreen`: chamfered stone frame from `FRAME`, dark well, cells with a spec row on top and a dark row at the bottom), 40×7 art px. It sits on the label line, right after `P1` / mirrored before `P2`, and is drawn at 1 art px into its own buffer, scaled by `hs`. The drop shadow is drawn outside the buffer, so it stays bottom-right when mirrored.
    - Content: a `-▸` glyph (iron while charging; player color when ready) and `DASH_SEGMENTS` 5 cells, one per 12 steps of cooldown. The cell being charged shows a partial dark fill.
    - Palettes: `DASH_RAMPS` (P1 = the `FACES.gold` ramp, P2 = a matching blue ramp).
    - Motion: pop-in spring when it appears (chain snaps). Each cell flashes as it lights. When all cells are full the bar pops and a glint sweeps every `DASH_GLINT_PERIOD` (off under reduced motion). Spending the dash shakes the bar.
    - Drawn only while `player.dashEnabled`, otherwise `hide()`.

## Data flow (driven from `js/Game.js`)
- Boot (`js/main.js`): `LoadingScreen.run('Loading the dungeon…', [assets.whenReady, roomCatalog.load])` → opening trailer (below) until START/SKIP → `run('Preparing the dungeon…', [new Game, game.audio.whenReady])` → `game.start()`. `#loading-screen` starts visible (no `ls-hidden` in HTML).
- `Game` constructor builds `hud`, `deathScreen` (`onRestart: restart`), and `pauseScreen` (`onResume: setPaused(false,{silent:true})`, `onRestart: restart`).
- Pause: `Game.setPaused(p)` → `gameLoop.setPaused`, `hud.setPaused`, `pauseScreen.show/hide`, `audio.stopAll` + ambience −12 dB, `playUi('uiOpen'|'uiClose')`. It is refused before `start()` or during game over.
- Game over: in `_updateGameplay` when any player has `lives <= 0` → `gameOver = true`, `deathScreen.show()`. `newDungeon()` hides it.
- HUD: `hud.draw` runs every render. It detects life changes by polling `player.lives` against `entry.seen`, and new player objects (restart) by identity, which resets the HUD. `transitionThroughDoor` → `hud.onRoomEnter(combat)`; room cleared → `hud.onRoomCleared()`.

## Input & focus
- Keyboard (`Game._bindButtons`, window `keydown`, ignores repeats): `Escape` toggles pause, `T` cycles tileset, `R` restarts (any time, even when paused), `Enter`/`Space` on game over restarts (only after `GAME_OVER_INPUT_DELAY_MS`, since they are also dash keys) unless the death button is focused. When it is focused, the native click handles it, which avoids a double restart.
- `PauseScreen` root `keydown`: ↑/W, ↓/S → `move`. Native `<button>` Enter/Space → click.
- Gamepad: all menu pad input goes through `MenuPad` (`js/core/MenuPad.js`, tuning `MENU_PAD` in `GameConfig`). Any pad counts. `poll()` returns edge hits `{start, a, b, up, down, left, right, any}`. Directions (D-pad 12–15 or left stick |axis| > 0.6) repeat while held (350 ms delay, then every 110 ms). Buttons held at the first poll do not fire, so the Start that pressed the trailer's START does not pause the new game. `Game` and `TrailerPlayer` each own one.
  - Game (`Game._pollMenuPad`, each frame via `GameLoop.onFrameStart`): Start toggles pause. In the pause: ↑/↓ `move`, ←/→ `adjust` (volume ±10 %), A `confirm`, B resume. Game over: Start or A restart after `GAME_OVER_INPUT_DELAY_MS` (death button shows pressed), B does nothing.
- Hover equals focus. `pointerenter` focuses the control. `uiMove` plays only when focus arrives from another `.pixel-btn` or from the pointer, so `show()` auto-focus is silent.
- Controls are gated by `enabled: () => screen.visible`. Hidden screens ignore clicks.

## Opening trailer
Restored on 2026-10-26 after `9b13c52` deleted it (see `status.md` #18). Only the boot trailer is in the repo; the old review pages (`trailer.html`, `b3.html`, `matchcut.html`) and `js/trailer/b3|matchcut` stay in history at `9b13c52~1`.
- Flow (`js/main.js`): `TrailerPlayer` is created before `assets.whenReady` → loading → `trailer.play()`. If the AudioContext is still suspended, a gate screen (logo + "CLICK OR PRESS ANY BUTTON (sound on)") waits for a pointer, a key (not Esc) or any pad button. Browsers do not count a pad button as a user gesture (Chromium issue 463233716), so after a pad press the trailer waits `PAD_UNLOCK_WAIT_MS` (300 ms) and, if the audio is still locked, plays muted (`stage.audio = null`). Electron sets `autoplayPolicy: 'no-user-gesture-required'`, so the gate does not appear there. Then 12 scenes (~126 s); the last one loops under START.
- `TrailerPlayer(canvas, assets, { onBegin, onEnd, onPadAction, showTimer, audio })`: `play(from)`, `stop()`, `setPaused/togglePause`, `paused`. `onBegin` → `overlay.showSkip()`, `onEnd` → `overlay.showStart()`. It pauses itself on `visibilitychange`.
- Input: Enter/Space press START when it is visible; Esc toggles the trailer pause. Pad (`TrailerPlayer._pollPad`, polled from the gate on): during the trailer, A presses SKIP (once visible) and Start toggles the pause. When START is visible, A or Start press it. Routing goes through `onPadAction(button)` → `TrailerOverlay.padAction`, which returns `true` when it consumed the button. In the pause: ↑/↓ navigate, ←/→ volume (with repeat), A confirms, B or Start resume.
- Audio: `TrailerAudio` (own WebAudio graph, follows `MasterVolume`) uses `assets/audio/trailer/*.wav`, `assets/audio/music/megasong.mp3`, and some game wavs. Images: `assets/keyart/logo.png`, `assets/fx/explosion.png`, player expressions.
- Trailer scenes import game classes (`Player`, `SawWeapon`, `Renderer`, `PostProcessor`, traps, particles). Changing those APIs can break the trailer: check `/` without `?skipTrailer` after such changes.

## Config knobs
`pixelScale()` = clamp(round(innerHeight/140), 3, 9), applied on resize and exposed as CSS `--px`. Palettes `FRAME`/`FACES`. HUD layout `_layout(W,H)` (S = bust scale, hs = heart scale), `BELOW_EDGE_ROWS`, `MOTION` (0.35 under `prefers-reduced-motion`). Loading bar `SEGMENTS`, `FLASH_MS`.

## Invariants & gotchas
- All UI art is drawn at 1 art-px into a small canvas, then CSS-scaled by an integer `pixelScale`. Keep `imageSmoothingEnabled = false` and integer coordinates.
- `PauseScreen` constructor clears `.pause-menu` (`innerHTML = ''`) and rebuilds its controls. Constructing it twice on the same root duplicates listeners on the root.
- `PauseScreen.confirm()` only clicks buttons. With the slider focused it does nothing.
- `onMove` is supported but `Game` does not pass it. `rootId`/`volume`/`restartLabel` exist for reuse: the trailer builds its own `#trailer-pause` (RESUME + volume, no RESTART) on first pause.
- HUD timing uses `performance.now()` (render time, capped 50 ms). It keeps animating while paused, by design: `Portrait.paused` shows `olhando_cima`.
- `VtuberHud.draw` resets the transform to identity. It must run after `renderer.endFrame()` (it does, in `_renderOverlays`).
- Death and pause screens are DOM, so they are not affected by lighting or vignette. The HUD is drawn after post-processing and is also unlit.
- Menu text is English (`RESUME`, `RESTART`); code comments and expression keys are pt-BR.

## How to extend
New screen: follow the `DeathScreen` pattern (root in `index.html` + CSS `.visible`, `PixelButton`s gated by `visible`, `show/hide` with `aria-hidden` and focus). Wire it from `Game` and route gamepad input in `_pollMenuPad`. See `.agents/playbooks/add-ui-screen.md`. New HUD element: draw it in `VtuberHud.draw` or after it in `Game._renderOverlays`, using `drawText` and integer scales.

## Tests
`tests/test_menu_pad.js` covers `MenuPad` (edges, first-poll latch, repeat, stick threshold, several pads). Screens have no automated tests. Verify in browser: `python serve.py` → http://localhost:8000, Escape/Start to pause, lose all lives for the death screen, test keyboard, mouse, and gamepad, and check the devtools console.

## Related docs
`audio.md` (UI cues, `MasterVolume`), `visual-effects.md` (render order), `.agents/playbooks/add-ui-screen.md`.
