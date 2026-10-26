# Review: player dash

Two-axis review (`code-review` skill) of the working tree vs `1cef7a6`, dash files only. The reviewers ran as parallel sub-agents, then I triaged the findings.

## Standards
- Fixed: none needed.
- Accepted:
  - `controls[4]` as the dash key. It is a positional contract with `EntityConfig`, documented in `players-and-chain.md`. A named map would touch `PlayerAI` and the trailer.
  - `dashButtons = [0, 5]` inline in `InputHandler`, like the existing D-pad 12–15.
  - `DashBar` as another class inside `VtuberHud.js`, matching the file's `Portrait`/`HeartRow` pattern.
  - `+15` foot offset in `_dashFeedback`. `ParticleEffects` uses the same literal.
- Noted (judgement calls, not changed):
  - `cancelDash()` is paired next to the duplicated spawn assignments in `newDungeon`/`transitionThroughDoor`.
  - Dash state adds ~12 fields to `Player`. A `PlayerDash` helper would be the next step if it grows.
- Scope: `Game.js`, `GameConfig.js`, `LightingRenderer.js`, `architecture.md` and `visual-effects.md` also carry the parallel hole-FX work (`HoleEffects`, `HOLE_FX`, task `2026-10-26-hole-depth`). It is not part of this change. Commit them separately: `Game.js` imports the untracked `js/systems/HoleEffects.js`.

## Spec
Fixed:
- A 2-tile gap was crossable when the dash started with the feet up to `edgeMargin` inside the hole (112 px reach + 8). The dash is now blocked while `feetInHole`. There is a test for it.
- Resuming the pause with Enter (P2 dash) or pad A (P1 dash) could fire a dash on the first step. Now `latchDashKey()` runs on resume, with a test.
- Space/Enter/pad A pressed to dash at the moment of death could restart instantly. Restart now waits `GAME_OVER_INPUT_DELAY_MS` (400 ms).
- The HUD flash could be spent while the bar was hidden. The bar now resets while hidden.

False positive:
- Dust direction. `triggerDust` moves the puffs opposite to the given dir, the same convention as run-start dust.

Accepted:
- `cancelDash()` starts the full cooldown. This reads "keep the cooldown" as "a cut dash counts as used".
- A respawn refill flashes the bar.
- Reconnecting mid-dash skips the saw-circle collision for ≤ 9 steps.
- Footsteps are suppressed during the dash, so there are no footprints over holes.

Summary: Standards had 0 hard issues in the dash scope (the worst finding was mixed scope with the hole-FX work). Spec had 4 fixes (the worst was the 2-tile crossing).
