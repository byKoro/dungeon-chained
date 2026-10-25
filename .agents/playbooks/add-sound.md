# Playbook: add a sound

Context: `.agents/context/systems/audio.md`.

## One-shot SFX
1. **Asset.** Put files in `assets/audio/`, kebab-case, variants suffixed `-01`, `-02`… (e.g. `chain-rattle-01.wav`). WAV or OGG. Trim leading silence, since playback starts at t=0.
2. **Cue.** Add an entry to `AUDIO_CONFIG.cues` in `js/config/AudioConfig.js`:
   ```js
   chainRattle: {
       description: "Corrente chacoalhando ao esticar",   // comments/descriptions in pt-BR
       files: [1, 2, 3].map(i => `assets/audio/chain-rattle-0${i}.wav`),
       volume: 0.5,          // 0..1, before mix master and user volume
       rate: 1.0,            // single number
       rateVariance: 0.06,   // ± uniform random added to rate
       pitchShift: true,     // rate changes pitch (preservesPitch=false)
       cooldownMs: 60,       // drop retriggers inside window (spammy events)
       maxVoices: 3,         // steal oldest when exceeded
       enabled: true
   },
   ```
   `AUDIO_CLIPS` and the `GameConfig.js` re-export update automatically. Do not edit them.
3. **Trigger.** Call it from the system that owns the event, using the `AudioManager` it already holds (`this.audio` in `Game`, `CombatSystem`, `ParticleEffects`):
   ```js
   this.audio?.play("chainRattle", { volumeMultiplier: k, rateMultiplier: 1 + combo * 0.03 });
   ```
   - `opts.volume`/`opts.rate` replace the config value (`!== undefined`). The `*Multiplier` options scale it. Prefer the multipliers.
   - A system without audio access should get `audio` injected through its constructor, like `CombatSystem({ audio })`. Do not import a new `AudioManager`.
   - For UI controls use `playUi("cue")` from `js/ui/UiSound.js`.
4. **Juice pairing (optional).** Big impacts pair with `this.audio.duck(-6, { attackMs: 10, holdMs: 150, releaseMs: 700 })` plus `renderer.triggerShake(n)`.

## Looped bed
Add a cue with `loop: true` (only `files[0]` is used). Then `this.audio.playLoop("name", { fadeMs })`, `setLoopLevel("name", db, fadeMs)`, `stopLoop("name")`. `play()` ignores loop cues.

## Parameter-driven loop (like the saw motor)
1. Cue with `loop: true`.
2. New module `js/<area>/XxxAudio.js` exporting a **pure** `xxxTargets(param, state) → { level, rate, cutoff }` and a class that wraps `audio.createLoopVoice("name")`, calling `voice.set(targets, tau)` / `voice.pulse({...})`. It must tolerate `voice === null`.
3. Update it once per frame. `SawMotorAudio` is updated from `GameLoop.onFrameStart` in `Game`.
4. Write `tests/test_xxx_audio.js` mirroring `tests/test_saw_motor_audio.js`: import the pure function, add a `FakeVoice` with `set/pulse/stop`, stub `globalThis.performance`, end with `process.exit(fails ? 1 : 0)`.

## Verify
- `python serve.py` → http://localhost:8000 (or `npm start` for Electron). Click or press a key first, because nothing plays before the first gesture.
- Devtools console: `audio.play("chainRattle")` should return an `<audio>` element. `null` means a typo in the name, `enabled:false`, empty `files`, a `loop` cue, or an active cooldown. Check `audio.clips.chainRattle` and the Network tab for 404s.
- `node tests/test_saw_motor_audio.js` (and any new test) must print `N/N ok`.

## Done checklist
- [ ] Files in `assets/audio/`, referenced paths match exactly (case-sensitive in packaged builds).
- [ ] Cue in `AUDIO_CONFIG.cues` with a pt-BR `description`.
- [ ] Triggered from the owning system. Spammy events have `cooldownMs`/`maxVoices`.
- [ ] Heard in-game at sensible level against `ambience`. No console errors.
- [ ] `.agents/context/systems/audio.md` "Call sites" list updated (and "Config knobs" if new constants).
