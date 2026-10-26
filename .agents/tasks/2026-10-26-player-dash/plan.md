# player dash

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/player-dash  Base: 1cef7a6  Date: 2026-10-26

## Goal
Each player gets an individual dash, usable only while the chain is snapped: short burst with full invulnerability, passes through enemies, jumps holes up to 1 tile. Design agreed in a grill session (see Decisions).

## Decisions (grill session 2026-10-26)
- Only while `!chain.isConnected`. Blocked while `falling`, `hurtTimer > 0`, paused (no sim). Same stats for both players.
- Keys: P1 Space, P2 Enter; gamepad A (0) / RB (5) mapped to those key names. Edge-triggered, no buffer.
- Direction: current 8-dir input; no input → last move direction. No steering during the dash.
- 9 steps × 12 px/step (~108 px), then velocity = 4.2 in the same direction (normal lerp takes over).
- I-frames: `takeDamage` returns false while `dashing` (separate from `invulnerableTimer`, no blink). Ignores entity collisions (not walls).
- Holes: no pushback/grace while dashing; if the dash ends with the feet beyond `edgeMargin` inside a hole, fall immediately (1 tile crosses, 2 never).
- Cooldown: 1 charge, 60 steps from dash end. Reset only on death-respawn (`respawnAt`) and restart (new Player). Door transition / new dungeon cut an in-progress dash but keep the cooldown. Reconnect mid-dash: dash finishes.
- HUD: thin bar under each heart row, player color, fills during cooldown, flash when full; only visible while the chain is snapped.
- FX: dust puff on start + 3–4 tinted afterimages, no shake. Audio: cue `playerDash` reusing `arrow-fire` pitched up (placeholder).
- Out of scope: PlayerAI dash (legacy bot), real whoosh asset.

## Context read
- `AGENTS.md`, `architecture.md`, `conventions.md`, `systems/players-and-chain.md`, `systems/ui.md`, `systems/audio.md`, `systems/visual-effects.md`, `status.md`
- `Player.js`, `Entity.js`, `InputHandler.js`, `Game.js`, `DungeonTileQuery.js`, `VtuberHud.js`, `AudioConfig.js`, `EntityConfig.js`, `tests/test_hole_resistance.js`
- Hole widths in `map/*.json`: mostly 2–4 tiles, 1-tile gaps in `corridor_new_0`, `room_esw_1`, `room_nsw_0`.

## Steps
- [x] 1. Config + input: `PLAYER_DASH` (GameConfig), dash key as `controls[4]` (EntityConfig), gamepad buttons 0/5 → dash key (InputHandler), `playerDash` cue (AudioConfig).
      Verify: `npm test`.
- [x] 2. Player dash state: `update(input, bounds, { canDash })`, `dashing`, `dashTimer`, `dashCooldown`, `dashCharge`, flags `justDashed`/`justEndedDash`, `cancelDash()`, reset in `respawnAt`, `takeDamage` guard, afterimage trail + tinted draw.
      Files: `js/entities/Player.js`.
      Verify: `tests/test_player_dash.js`.
- [x] 3. Holes: skip dashing players; immediate fall on `justEndedDash`.
      Files: `js/rooms/DungeonTileQuery.js`. Verify: test + `test_hole_resistance`.
- [x] 4. Game wiring: `canDash = !chain.isConnected`, exclude dashing players from entity collisions, cancel on door/newDungeon, audio + dust on `justDashed`.
      Files: `js/Game.js`.
- [x] 5. HUD dash bar. Files: `js/ui/VtuberHud.js`. Verify: manual.
- [x] 6. Review fixes: no dash start with feet in a hole (`tiles.feetInHole`), `latchDashKey` on resume, `GAME_OVER_INPUT_DELAY_MS`, HUD bar resets while hidden. See review.md.

## Docs to update when done
- [x] `systems/players-and-chain.md`, `systems/ui.md`, `systems/audio.md`, `systems/visual-effects.md`
- [x] `status.md`, `glossary.md` (dash)
- [x] ADR: not structural
