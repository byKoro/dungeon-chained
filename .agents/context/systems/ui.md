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
| `js/ui/PixelFont.js` | 5-px bitmap font: `drawText(ctx,text,x,y,color,maxChars)`, `measureText`, `wrapText`, `LINE_HEIGHT`=10; pt-BR accents composed; `[`, `]`, `+` included; unknown char → `?` |
| `js/ui/PixelButton.js` | `PixelButton` class, `renderPixelButton`, `drawStoneFrame`, `controlSize`, `pixelScale()`, palettes `FRAME`, `FACES` (`red`/`gold`/`stone`) |
| `js/ui/PixelSlider.js` | `PixelSlider` (volume), `renderPixelSlider` |
| `js/ui/PauseScreen.js` | RESUME / RESTART / volume slider; focus navigation |
| `js/ui/DeathScreen.js` | single RESTART button |
| `js/ui/LoadingScreen.js` | segmented progress bar; `run(text, tasks)` |
| `js/ui/TrailerOverlay.js` | SKIP (gold, after 3 s) / START (red, at trailer end) over the opening trailer |
| `js/ui/SpeechBubble.js` | `renderSpeechBubble(text, accent, maxChars)` (trailer and in-game bubbles) |
| `js/systems/DialogueSystem.js` | in-game speech bubbles: queue, typewriter, voice blip, HUD expression hook |
| `js/ui/ScrapCounter.js` | top-center scrap counter (Editor 2.0 maps only) |
| `js/systems/roomScripts/InicialRoomScript.js` | dialogue script of the `inicial` room (see below) |
| `js/i18n/I18n.js`, `pt-BR.js`, `en.js` | `t(key, vars)`, `setLanguage`, `getLanguage`; tables `PT_BR`, `EN` (ADR 0013) |
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

- `VtuberHud.pixelScale(W, H)` returns the heart scale (`hs`) so other HUD pieces match its pixel size. `speak(i, expr, dur)` plays an expression on portrait `i` (+ hop) and `talkBlip(i)` kicks its squash; both are driven by `DialogueSystem`.
- `ScrapCounter({ getAmount, frames })`: `draw(ctx, W, H, scale)`, `reset()`. Stone panel at 1 art px (coin icon placeholder + at least 2 digits), drawn at `hud.pixelScale`. The shown number rolls toward the pot; each gain makes the panel hop and lights the digits. `Game` draws it after `hud.draw` and resets it in `newDungeon`.
- `DialogueSystem({ getPlayers, input, audio, onLineStart, onBlip, cfg = DIALOGUE, translate = t })`: `say(who, key, { vars, expr })` (who = player index 0/1 or the `Player`), `clear()`, `active`, `update(dt)`, `draw(ctx, renderer, canvas)`. One line at a time from a queue; 40 letters/s, then a hold of `holdBase + holdPerChar·len`, fade out, `gapSeconds` until the next. Interact (`e` / `shiftright`, pad button 2 maps to them) completes the text, a second press skips the line; a key already held when the system starts does not count. Blip `voiceBlip` every 2nd non-space letter, rate `DIALOGUE.blipRates[i]` (Amarelo lower, Azul higher). Completing the text does not play the skipped blips. Built only with `mapData` (`game.dialogue` is `null` in the classic mode). The same tap is also seen by `DemoProgress` (an interactive in range activates too). In F6 split mode the bubble uses the shared camera, so it is misplaced. The game does not pause. `DIALOGUE.enabled = false` turns every `say` into a no-op (the script is still being tested). The bubble is drawn in screen space above the speaker's head (`headOffset`), one bubble art px = one game art px (`TILE/16·zoom`), after post-processing so lighting does not dim it. No button icons per device yet ("[E]" is literal text).
- Dialogue script (design §6, still being tested): `InicialRoomScript` plays `talk.start.1/2` `SCRIPT_LINES.startDelaySteps` after entering the room, `talk.chest1` when a chest without `encounter` opens, `talk.anvilNear` within `anvilNearTiles` of the anvil, and `talk.bossGate` + `talk.rightDoor` within `bossGateTiles` of the boss gate. Each plays once per run: the id (`talk:start`, …) goes into `RoomEvents.completed`, which survives the run death. `talk.rope1`, `talk.wave1Clear`, `talk.chest2` come from `CageEncounter`, `talk.sawReady` and `talk.connected.*` from `Game`. `SCRIPT_LINES.enabled = false` turns off the `InicialRoomScript` lines and `talk.connected.*`; `DIALOGUE.enabled = false` turns off every line.

- **Anvil menu** (`ForgeSystem` + `ForgeMenu`, Editor 2.0 maps): a player within `FORGE.openRadius` (1,7 tiles) of an anvil sees the prompt bar `forge.prompt` (or `forge.blocked` while any enemy in the room is alive) and opens the menu with interact. While open the game is frozen (`Game._step` only moves the camera). Both players drive one cursor: W/S, arrows (real keyboard only, `input.keyboardKeys`, edges per key) and D-pad/stick (`MenuPad`) move; Space/Enter/pad A buys; E / Right Shift / pad X (interact), pad B, Start or Esc closes. Opening consumes the interact tap (dialogue and `DemoProgress` are latched; `forgeSystem.update` runs before them). It does not open during a door transition or game over, and no door transition starts while it is open. The bottom prompt bar is hidden while it is open. The cursor starts on the first buyable row. Rows show name, level pips, cost with the coin icon, `MAX` when maxed; locked (needs the Saw) and unaffordable rows are dimmed and the info line says why. A refused purchase flashes the row and shakes the panel. Drawn on the canvas at 1 art px (156 px wide) scaled by `pixelScale()`, centered over a dark veil, after the HUD. Keys that were held when it opened do not act until released; on close both players `latchDashKey()`. Sounds: `uiOpen`, `uiClose`, `uiMove`, `forgeBuy`; refused = `uiMove` at 0,6 rate.
- **Saw cinematic** (`SawForgeCinematic`, after buying the Saw): letterbox bars (`barRatio` 12% each), camera focus on the anvil (`DemoCamera.focus`, zoom ×1,7), three `forgeHammer` hits with sparks and growing shake (3/5/8), the saw jumps (120 px, 3 turns), lands on the anvil with squash and a glow pulse, bars leave. Then the saw stays on the anvil and Azul says `talk.sawReady`. On the first reconnect the disc pops bigger (no title text) and Amarelo/Azul say `talk.connected.1` / `talk.connected.2`. No skip (it only happens once per run).

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

## Cinematic bars (2026-10-28)
CinematicBars (js/ui) uses CINEMATIC_BARS (js/config): 10% of canvas height per edge, cubic ease-out over 0.4 s in / 0.18 s out. TrailerStage owns it; TrailerPlayer updates it only while unpaused. finish() freezes the scene and resolves after the bars exit; bootstrap awaits it before stopping the trailer/loading Game. Stage barH reserves the full inset for portrait framing, independent of animation and zoom. Sanctuary integration remains planned.

## Barra de chefe (`BossHealthBar`)

`js/ui/BossHealthBar.js` + `js/config/BossBarConfig.js`. Construída por `Game` (`this.bossBar`), desenhada em `_renderOverlays` logo depois do HUD, em coordenadas de tela (não deforma com zoom, pausa ou resize). `getState()` devolve `{ name, hp, max, phaseAt }` do chefe da sala atual que tem `hasBossBar` e já saiu do spawn congelado (`Game._bossBarState`); null quando não há encontro. Mostra HP zero durante a animação de morte e some quando o chefe vira escombro. `Game.newDungeon` e `transitionThroughDoor` chamam `reset()`. Visual: moldura de pedra (`FRAME` de `PixelButton`), texto em `PixelFont` ("Arauto das Brasas") à esquerda e preenchimento vermelho com rastro de dano e marca da fase 2. O layout (`layout()`) usa `VtuberHud.freeSpan()` (faixa livre entre os retratos/corações dos jogadores); em janela estreita a barra sobe para acima do HUD. Não há barra para os golems das cenas roteirizadas do trailer.

### Barra de chefe — nova arte (2026-10-29)
`BossHealthBar` agora desenha uma placa de nome acima da barra (nome em maiúsculas, degradê creme → âmbar com contorno escuro e chamas de pixel dos dois lados) e uma barra com moldura de pedra (rebites), emblema de chama na ponta esquerda, preenchimento em degradê de brasa, marcações a cada 10%, rastro de dano e marca dos 50%. Na fase 2 (`state.phase >= 2`) a paleta esquenta e um brilho pulsa. `layout()` inclui a placa (`plateHeight()`, `barTop`). Tamanhos e cores em `BossBarConfig.js` (`nameScale`, `barHeight`, `colors.fill`). A altura total cresce com a placa; continua na faixa livre do HUD.

### Boss phase cinematic HUD (2026-10-29)
VtuberHud.onBossTransformation(expression|null) explicitly overrides both portraits (assustado then raiva), clearing at completion/reset. CinematicBars are reused below HUD, keeping reactions visible. ArautoPhaseScene in Game coordinates ~3s camera/bars/phase reveal and selective gameplay freeze. See visual-effects.md; actual Game screenshots checked.
