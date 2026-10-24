# Per-sound audio configuration via AudioConfig.js

Me review change. It move audio defaults out of code into one hand-editable file. New `js/config/AudioConfig.js` export `MASTER_VOLUME` and `AUDIO_CONFIG`, where each sound carry its own `files`, `volume`, and `rate` (fixed number or `[min,max]` jitter). `AudioManager` now resolve those defaults at play time and multiply by master volume with a final 0..1 clamp; the 7 call sites drop their inline `{ volume, rate }` objects and become bare `play("name")` calls. Old `AUDIO_CLIPS` map leave `GameConfig.js` entirely.

**Watch for:** nothing blocking. Inline `base + rand*span` rate expressions converted to `[min,max]` arrays — all 7 match (confirmed). Volumes preserved from call sites (confirmed). No security surface touched (no auth, network, credentials). **Verdict**: APPROVED

## High-level view

Design centralize per-sound tuning in `AUDIO_CONFIG` keyed by sound name, so a non-coder change `files`/`volume`/`rate` without touching logic. `AudioManager` go from a bare clip map to a config consumer: constructor take `(config, masterVolume)`, preload variants, and `play` resolve `volume = clamp01((override ?? config.volume) * master)` and `rate = override ?? (array -> random in range, else number)`. Override path survive, so per-call tuning still possible even though every current call site now rely on the config default.

Rate migration is the one place correctness matter most: each old `base + Math.random()*span` become `[base, base+span]`. All seven conversions match the briefing exactly. Volumes carry over unchanged from the inline call sites.

The clone/overlap playback, the active-set bookkeeping, the `ended` cleanup, and the `.catch` removal-on-failure are preserved byte-for-byte; unknown sound name still return silently. `MASTER_VOLUME` default 1.0 mean behavior is identical to before until someone lower it. No asset path renamed, no dependency added.

<details>
<summary>Issues (0)</summary>

No blocking or non-blocking findings. Change matches the plan and verification note.

</details>

<details>
<summary>Details</summary>

### Config shape and the rate migration

`AUDIO_CONFIG` keep the exact `.map` generators from the old `AUDIO_CLIPS` (same `padStart`, same `0${i}` patterns, same file extensions), so the asset paths resolve identically. The migration risk live entirely in the rate expressions, since inline randomized rates became declarative ranges. Checked each (confirmed):

```
pickup            0.95 + rand*0.10  -> [0.95, 1.05]   ✓
playerHurt        0.90 + rand*0.20  -> [0.90, 1.10]   ✓
enemyStep         0.68 + rand*0.08  -> [0.68, 0.76]   ✓
enemyAttack       0.85 + rand*0.15  -> [0.85, 1.00]   ✓
enemyAttackVoice  0.85 + rand*0.15  -> [0.85, 1.00]   ✓
monsterHurt       0.85 + rand*0.20  -> [0.85, 1.05]   ✓
playerStep        0.92 + rand*0.16  -> [0.92, 1.08]   ✓
```

Volumes (0.75 / 0.58 / 0.35 / 0.32 / 0.45 / 0.3 / 0.65) match the values that previously lived inline. The Portuguese header documents each field in plain terms (`files` to swap/add/remove variations, `volume` louder/quieter, `rate` fixed or `[min,max]` for natural jitter, `MASTER_VOLUME` as global multiplier) — it genuinely guides hand-editing rather than restating field names.

### AudioManager resolution

The `??` precedence keep per-call override working, so the API did not lose expressiveness even though no call site use it anymore. `enemyStep` and `playerStep` intentionally share the same footstep files with different volume/rate — preserved from the original. The `rand` formula `sound.rate[0] + Math.random() * (sound.rate[1] - sound.rate[0])` reproduce the old `base + rand*span` distribution exactly. The clone-and-overlap path (`cloneNode()`, `this.active.add`, `ended` listener with `{ once: true }`, and `.catch` that removes the clone on play rejection) is unchanged, and unknown name still return silently via `if (!sound?.variants.length) return`.

### Call sites and the old config removal

The 7 inline-option calls collapsed to bare `play("name")`: pickup in `Game.js`, five in `CombatSystem.js` (playerHurt / enemyStep / enemyAttack / enemyAttackVoice / monsterHurt), one in `ParticleEffects.js` (playerStep). The surrounding guards (`if (this.audio)`, `justStepped`/`justAttacked` conditions) and the per-player `footstepSoundCooldown` logic are untouched. `Game.js` import path is `./config/AudioConfig.js` (correct relative to `js/`) and constructs `new AudioManager(AUDIO_CONFIG, MASTER_VOLUME)`. `AUDIO_CLIPS` and its stale "Áudio" comment removed from `GameConfig.js`; the verification note records grep finding zero remaining references in `js/`.

### Verification evidence

The verification note records `node --check` exit 0 on all six touched files, a `js/`-wide grep for `AUDIO_CLIPS` returning nothing, and a grep for inline `audio.play(... {` option objects returning nothing. Evidence is present and consistent with the diff; no re-run or spot-check warranted. Runtime audio playback is browser-only and out of scope for static verification, as the note states.

</details>

<details>
<summary>File map</summary>

- `js/config/AudioConfig.js` — new; exports `MASTER_VOLUME` and `AUDIO_CONFIG` with per-sound files/volume/rate.
- `js/core/AudioManager.js` — constructor takes `(config, masterVolume)`; `play` resolves config defaults, master multiplier, and array-rate jitter.
- `js/Game.js` — imports from AudioConfig, constructs manager with master volume, pickup call made bare.
- `js/config/GameConfig.js` — `AUDIO_CLIPS` export and comment removed.
- `js/combat/CombatSystem.js` — 5 call sites stripped of inline options.
- `js/systems/ParticleEffects.js` — playerStep call stripped of inline options.

Full diff: `git diff origin/main HEAD`

</details>
