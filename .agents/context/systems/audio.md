# Audio

## Purpose
Plays one-shot SFX (HTMLAudioElement clones), looped beds (Web Audio buffers), and a parameter-driven saw motor loop. A single data table (`AUDIO_CONFIG`) holds every cue; gameplay code calls `audio.play("<cueName>", opts)`.

## Files
| File | Role |
|---|---|
| `js/config/AudioConfig.js` | `AUDIO_CONFIG` (mix master, `muted`, `cues`), `getAudioClipsMap()`, `AUDIO_CLIPS` |
| `js/config/GameConfig.js` | re-exports `AUDIO_CONFIG`, `AUDIO_CLIPS` (line ~98) |
| `js/core/AudioManager.js` | `AudioManager`: one-shots, loops, ducking, master, stream tap |
| `js/core/LoopVoice.js` | `LoopVoice`: one continuous loop with level/rate/lowpass + `pulse()` wobble |
| `js/core/MasterVolume.js` | `MasterVolume` singleton: user volume slider value, persisted in localStorage |
| `js/weapons/SawMotorAudio.js` | `motorTargets(spin, state)` (pure) + `SawMotorAudio` controller over a `LoopVoice` |
| `js/ui/UiSound.js` | `playUi(cue, opts)`, `setUiAudio(mgr)`, `preloadUi()`; UI cue router |
| `assets/audio/*.wav|.ogg` | audio files (kebab-case, `-0N` suffix for variants) |
| `tests/test_saw_motor_audio.js` | node unit test for `motorTargets`/`SawMotorAudio` |

## Key types & APIs
Cue shape (`AUDIO_CONFIG.cues.<name>`):
```js
{ description, files: [paths], volume: 0..1, rate: number, rateVariance: number,
  pitchShift?: bool, cooldownMs?: number, maxVoices?: number, loop?: bool, enabled: bool }
```
- `rate` is a single number; randomization is `rate + uniform(-rateVariance, +rateVariance)`. There is no `[min,max]` form.
- `pitchShift: true` sets `audio.preservesPitch = false` so rate changes pitch (otherwise browsers time-stretch).

`AudioManager` (instance lives at `game.audio`, also `window.audio`):
- `play(name, { volume, rate, volumeMultiplier, rateMultiplier })` → returns the cloned `<audio>` or `null`.
  - volume: `(opts.volume !== undefined ? opts.volume : cue.volume ?? 0.7) * volumeMultiplier * config.masterVolume`, clamped 0..1.
  - rate: `opts.rate` if given, else `cue.rate ± rateVariance`; then `* rateMultiplier`, clamped 0.2..4.
  - Picks a random variant from `files`, never the same index twice in a row (`_lastVariant`).
  - `template.cloneNode()` per call → overlapping playback.
  - `cooldownMs` drops calls inside the window; `maxVoices` steals the oldest voice.
- `playLoop(name, { fadeMs=2000 })`, `stopLoop(name, { fadeMs=800 })`, `isLoopPlaying(name)`, `setLoopLevel(name, levelDb, fadeMs=600)`.
- `createLoopVoice(name)` → `LoopVoice | null` (used only for `sawMotor`).
- `duck(amountDb, { attackMs, holdMs, releaseMs })`: overlapping ducks keep the deepest level and longest hold.
- `setMasterVolume(v)` / `getMasterVolume()`, `toggleMute(m?)`, `setVolume/getVolume(cue)`, `setEnabled(cue, b)`, `setFiles(cue, files)` (creates cue if missing), `stopAll()`, `whenReady(timeoutMs=4000, onProgress)`, `createStreamTap(gain)` (MediaStream for recording).

`LoopVoice`: `set({level, rate, cutoff}, tau)`, `pulse({cents, gainDb, hz, decay, duration})`, `stop(fadeMs)`, `started`.
`SawMotorAudio`: `update(spin, {connected, active, timeScale})`, `onHit()`, `onSnap()`, `stop()`; tolerates `voice === null`.
`MasterVolume`: `.value` (0..1, step 0.05, default 0.8), `.gain(v)` = v², `.set(v)`, `.subscribe(fn)` (calls fn immediately, returns unsubscribe). Key `dungeonChained.masterVolume`.

## Data flow
1. `main.js` → `new Game()` → `new AudioManager(AUDIO_CONFIG)`; constructor creates an `Audio` per file for every non-loop cue (`_loadAllClips`). Loading screen awaits `game.audio.whenReady(4000, …)`.
2. `Game` constructor: `MasterVolume.subscribe(() => audio.setMasterVolume(mixMaster * MasterVolume.gain()))`, where `mixMaster = AUDIO_CONFIG.masterVolume`. Then `setUiAudio(this.audio)`.
3. `Game.start()`: `playLoop("ambience", {fadeMs:3000})` and `new SawMotorAudio(audio.createLoopVoice("sawMotor"))`. These lazily create the `AudioContext` (`_ensureContext`).
4. Every frame `GameLoop.onFrameStart` → `Game._updateSawMotor()` → `sawMotor.update(weapon.spinSpeed, {connected, active, timeScale})`.
5. Gameplay events call `audio.play(...)` directly (see call sites).

Web Audio graph: `loop gain → _duckNode → _preNode → _masterNode → destination`. `LoopVoice: source → lowpass → pulseGain → levelGain → _preNode`. One-shots are plain HTML elements and bypass the graph unless `createStreamTap()` was called (then each clone is routed via `_routeToGraph` into `_sfxBus → _preNode`).

## Call sites (cue → where)
- `playerStep` `ParticleEffects.handleStep` (cooldown 7/10 sim steps on `player.footstepSoundCooldown`)
- `enemyStep`, `enemyAttack`, `enemyAttackVoice`, `playerHurt` `CombatSystem.updateEnemies`
- `monsterHurt`, `sawHit` (combo pitch via `_playSawHit`, `HIT_COMBO_*`) `CombatSystem.resolveWeaponHits`
- `sawSnap` `Game._updateGameplay` onSnap + `Game._dropSawOnFall`; `sawPickup` onReconnect; `sawLand` `Game._updateSawLanding`
- `playerFall`, `playerHit` (rate 0.88 at 1 life), `doorOpen`, `enemySpawn` (`_updateRoomIntro`), `pickup` (`_playHeartPickup`, streak +6%/pickup up to 4)
- `buttonPress` (×1.12 when all pressed), `buttonRelease` `Game._buttonFeedback`; `arrowFire` `Game._arrowTrapFeedback` (distance attenuation 160..640 px → ×1..×0.35)
- `playerStep` also at dash landing (`Game._dashLandFeedback`, rate × `PLAYER_DASH.landStepRate`).
- `playerDash` `Game._dashFeedback` on `player.justDashed`. PLACEHOLDER: reuses the `arrow-fire-0N.wav` files at `rate` 1.45 until a real whoosh exists.
- `uiMove`, `uiConfirm` `PixelButton`/`PixelSlider`; `uiOpen`/`uiClose`/`uiConfirm` `Game.setPaused`, `_pollMenuPad`, `_bindButtons`
- Loops: `ambience` (`setLoopLevel` −12 dB paused, −10 dB game over, 0 on resume/new dungeon), `sawMotor` (LoopVoice)
- Ducks: sawHit −7, sawSnap −9, playerFall −8, playerHit −6, sawPickup −4 dB.

## Config knobs
- Per cue: `volume`, `rate`, `rateVariance`, `pitchShift`, `cooldownMs`, `maxVoices`, `enabled`, `files`.
- `AUDIO_CONFIG.masterVolume` = mix headroom (multiplied with the user slider); `AUDIO_CONFIG.muted`.
- Saw motor curve constants at top of `SawMotorAudio.js` (`SILENCE_SPIN`, `RATE_MIN/MAX`, `CUTOFF_MIN/MAX`, `DROPPED_LEVEL`, `SLOWMO_RATE_DEPTH`, `HIT_MERGE_MS`).
- Combo pitch: `HIT_COMBO_WINDOW_MS`, `HIT_COMBO_PITCH_STEP`, `HIT_COMBO_MAX_STEPS` in `CombatSystem.js`.

## Invariants & gotchas
- Unknown or empty cue: `play()` returns `null` silently (no warning). Same for `enabled:false` and `loop:true` cues. Typos fail quietly, so check the return value or `window.audio.clips` in devtools.
- Autoplay: before the first user gesture, `audio.play()` rejects. The rejection is caught (`release`) and the sound is dropped. The AudioContext resumes on the first `pointerdown`/`keydown`/`touchstart` (`_unlockOnGesture`).
- `loop: true` cues are not preloaded as clips and `play()` ignores them. Use `playLoop` (only `files[0]` is used) or `createLoopVoice`.
- `duck()` only affects `playLoop` beds (the `_duckNode` path). It does not affect one-shots or the saw `LoopVoice` (routed to `_preNode`). It is a no-op until the AudioContext exists.
- `setMasterVolume` changes volume of new one-shots and loops; clones already playing keep their volume.
- `stopAll()` (called on pause) stops one-shots only. Loops continue; ambience is lowered with `setLoopLevel`, and the motor goes silent via `active:false`.
- `enemyStep` and `playerStep` intentionally share `footstep-stone-0[1-6].ogg`; enemies use `rate 0.72`.
- `playerHurt` (CombatSystem, on enemy contact) and `playerHit` (Game, on any life loss) both use `player-hit-0N.wav`. An enemy hit can therefore fire both.
- `monsterHurt` and `enemyAttackVoice` are `enabled:false` with `files: []`. They are placeholders and their calls are no-ops. `CombatSystem` still calls `monsterHurt` on each saw hit so a future wound sound only needs files + `enabled:true`; until then `sawHit` is the only audible confirmation (a poise break plays it with `HIT_FEEL.poiseBreakAudio`: lower rate, higher volume, −9 dB duck). Missing assets: enemy wound/grunt and a heavier stagger/poise-break impact.
- `AUDIO_CLIPS` (name → files) has no consumer in `js/` besides the re-export. It exists for compatibility; `AudioManager._normalizeConfig` still accepts that legacy flat map.
- `whenReady` waits only for one-shot clips (not loop buffers) and resolves after `timeoutMs` regardless.
- Debug globals: `window.audio`, `window.audioConfig`, `window.sawMotor`.
- `UiSound` falls back to a private `AudioManager` containing only `uiMove/uiConfirm/uiOpen/uiClose` when `setUiAudio` was never called (pages without `Game`). `preloadUi()` has no callers.

## How to extend
New one-shot: add a cue to `AUDIO_CONFIG.cues`, drop files in `assets/audio/`, call `this.audio.play("name")`. See `.agents/playbooks/add-sound.md`. New continuous sound driven by a parameter: copy the `SawMotorAudio` pattern (pure `xxxTargets()` mapping + thin controller over `createLoopVoice`).

## Tests
`node tests/test_saw_motor_audio.js` (prints `N/N ok`, exit 1 on failure). It uses a `FakeVoice` and stubs `globalThis.performance`. Nothing else in audio is unit-tested. `AudioManager` needs a browser (`Audio`, `AudioContext`).

## Related docs
`visual-effects.md` (shake/flash paired with sounds), `ui.md` (UI sounds, volume slider), `.agents/playbooks/add-sound.md`.
