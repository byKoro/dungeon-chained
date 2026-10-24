# Merge branch-rodrigo -> main: audio + heart drop ported into refactored subsystems

Me look. Merge of `branch-rodrigo` into `main` keep refactor arch (`Game.js` + subsystems) and port rodrigo features (AudioManager, HeartPickup) into project PADRAO instead of reintroduce monolith. Conflict was only `js/main.js` (bootstrap vs monolith) and got resolved to HEAD bootstrap. Audio clips moved to `AUDIO_CLIPS` in `GameConfig.js`, `AudioManager` instanced in `Game.js` and threaded into `CombatSystem` and `ParticleEffects`; heart state lives on `Room`, drop in `CombatSystem.resolveDeaths`, collect/heal/render in `Game.js`.

Watch for: nothing blocking. All wiring real, no dead code, no conflict markers, asset paths match real files. (confirmed)

**Verdict**: APPROVED

## High-level view

The `js/main.js` conflict resolved to the HEAD side exactly as the briefing dictates — a ~15-line bootstrap that imports `Game` and `RoomCatalog`, awaits `roomCatalog.load()`, and calls `game.start()`. It no longer imports `AudioManager` or `HeartPickup`; those belong to `Game.js`, which imports both. No conflict markers remain anywhere under `js/`.

Audio follows the project pattern instead of the monolith. Clip paths live as `AUDIO_CLIPS` in `GameConfig.js`, `Game` constructs `new AudioManager(AUDIO_CLIPS)` and injects it into `CombatSystem` and `ParticleEffects`. The sounds are genuinely fired: `CombatSystem` plays playerHurt, monsterHurt, enemyStep, enemyAttack, and enemyAttackVoice; `ParticleEffects.handleStep` plays playerStep behind the per-player `footstepSoundCooldown`; `Game._updateHearts` plays pickup on collection. All volume/rate values match the briefing.

The heart drop uses `Room` as the owner of state. `Room` has `this.hearts`, seeds `heartCount` hearts in `populate`, and exposes `addHeart`. `CombatSystem.resolveDeaths` rolls `heartDropChance` (defaulting to 40%) and drops at the dead enemy. `Game` updates and collects hearts (lives capped at 3) and draws them on the floor layer under entities.

The public API of `AudioManager` and `HeartPickup` is untouched, and no audio asset files were modified. The `AUDIO_CLIPS` paths all resolve to files that exist under `assets/audio/`.

<details>
<summary>Issues (0)</summary>

No blocking or non-blocking findings.

</details>

<details>
<summary>Details</summary>

### main.js conflict resolved to HEAD bootstrap

`js/main.js` is the HEAD bootstrap verbatim from the briefing: imports `Game` and `RoomCatalog`, `bootstrap()` builds the catalog, awaits `roomCatalog.load()`, constructs `new Game(canvas, { roomCatalog })`, and calls `game.start()`. No `AudioManager` or `HeartPickup` import leaked into it. A repo-wide search for `<<<<<<<`, `>>>>>>>`, and a standalone `=======` across `js/**/*.js` returned nothing, so no conflict markers survive. (confirmed)

### AudioManager threaded through the subsystems, not dead code

`Game` constructs `this.audio = new AudioManager(AUDIO_CLIPS)` and passes it into both `CombatSystem` (`{ renderer, particleSystem, audio: this.audio }`) and `ParticleEffects` (`{ particleSystem, bloodCanvas, audio: this.audio }`). Each play site is reached from a live code path:

- `CombatSystem.updateEnemies`: `playerHurt` fires inside the enemy damage callback when `hitPlayer` is truthy (volume 0.75, rate 0.9 + random*0.2); `enemyStep` on `e.justStepped` (0.32, 0.68 + random*0.08); `enemyAttack` (0.45, 0.85 + random*0.15) and `enemyAttackVoice` (0.3, same rate) on `e.justAttacked`.
- `CombatSystem.resolveWeaponHits`: `monsterHurt` fires right after `enemy.startDying()` (0.58, 0.85 + random*0.2).
- `ParticleEffects.handleStep`: `playerStep` (0.35, 0.92 + random*0.16) gated by `footstepSoundCooldown`, reset to 7 when running (`speedMag > speed*0.7`) or 10 otherwise, and decremented each frame in `processPlayer`. This matches the rodrigo cooldown behavior.
- `Game._updateHearts`: `pickup` (0.65, 0.95 + random*0.1) on collection.

All volume/rate values match the briefing. The `audio` dependency is guarded (`if (this.audio)`), so the subsystems stay safe if audio is ever absent, without becoming dead code in the wired-up game. (confirmed)

### AUDIO_CLIPS paths match the real asset files

`GameConfig.AUDIO_CLIPS` maps the seven clip names to path arrays. `playerHurt` uses `padStart(2,"0")` for `player-hurt-01..06.wav`; `monsterHurt`/`enemyStep`/`playerStep`/`enemyAttack`/`enemyAttackVoice` use the `0${i}` form (valid for i=1..9). The referenced files — `player-hurt-01..06.wav`, `monster-hurt-01..03.ogg`, `footstep-stone-01..06.ogg`, `enemy-attack-01..03.wav`, `monster-attack-01..03.ogg`, `item-pickup.flac` — are present under `assets/audio/`. No 404 risk from the clip map. (confirmed)

### HeartPickup owned by Room, dropped by CombatSystem, collected/rendered by Game

`Room` initializes `this.hearts = []`, and `populate` seeds hearts when `Number.isInteger(cell.heartCount)` is true and > 0, scattering them around the room center using `bounds` (`±180` x, `±120` y) via `addHeart`. `CombatSystem.resolveDeaths` reads `room.cell.heartDropChance`, computes `Number.isFinite(chanceField) ? chanceField/100 : 0.40`, and on `Math.random() < dropChance` calls `room.addHeart(enemy.x, enemy.y)` before removing the enemy. `Game._updateHearts` iterates `room.hearts`, updates each, and lets any player with `lives < 3` within `heart.radius + player.hitRadius` collect: `lives = Math.min(3, lives + 1)`, play pickup, splice. `Game._render` draws `rooms.current.hearts` on the floor layer after `drawFloor`/effects and before shadows/entities. The HeartPickup API (`constructor(x,y)`, `update()`, `draw(ctx)`, `radius`) is unchanged. (confirmed)

### Verification evidence

The coder reported a grep for conflict markers, `node --check` on each modified file, and an import check. The marker grep is corroborated independently here (no matches under `js/`). Import topology: `main.js` imports neither feature; `Game.js` imports `AudioManager` directly; `HeartPickup` is imported in `Room.js`, which owns the heart list and is driven by `Game`.

One note on the acceptance wording: the criterion says "js/Game.js importa ambos," but `HeartPickup` is imported in `Room.js`, not `Game.js`. This is not a defect — the briefing's own Porte 2 instructs importing `HeartPickup` in `Room.js` (Room owns `this.hearts` and `addHeart`), which is the correct subsystem placement. The summary criterion and the detailed instruction disagree on wording only; the implementation follows the detailed instruction. Non-blocking. (confirmed)

Syntax validity was not re-run per instructions; the code reads as valid ESM. (confirmed)

</details>

<details>
<summary>File map</summary>

- `js/main.js` — conflict resolved to HEAD bootstrap; no audio/heart imports.
- `js/config/GameConfig.js` — added `AUDIO_CLIPS` clip map.
- `js/Game.js` — constructs `AudioManager`, injects into subsystems; `_updateHearts` collect/heal; renders hearts on floor layer.
- `js/combat/CombatSystem.js` — plays playerHurt/monsterHurt/enemyStep/enemyAttack/enemyAttackVoice; rolls heart drop in `resolveDeaths`.
- `js/rooms/Room.js` — `this.hearts`, `addHeart`, seeds `heartCount` in `populate`; imports `HeartPickup`.
- `js/systems/ParticleEffects.js` — plays playerStep with `footstepSoundCooldown`.
- `js/core/AudioManager.js`, `js/entities/HeartPickup.js` — came with merge, API unchanged.

Full diff: `git diff main` (merge in progress, not committed).

</details>
