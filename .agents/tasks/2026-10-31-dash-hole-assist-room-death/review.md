# Review — dash hole assist + room-scoped death

Date: 2026-10-31

## Scope of change
1. Dash-over-hole landing assist (config + Player.holeGrace + DungeonTileQuery._dashLandAssist).
2. Fall respawn near the hole when lives remain (Game._resolveFall).
3. Room-scoped death on 0 lives (Game._respawnRoom + ForgeState/ChestSystem/RoomEvents/RoomManager helpers), replacing _respawnRun. ADR 0014.

## Self-review notes
- ADR 0002/0003 respected: new behaviour lives in the owning subsystems (DungeonTileQuery, RoomManager, RoomEvents, ChestSystem, ForgeState); Game orchestrates. Tuning numbers (`dashLandAssistTiles`, `dashGraceSteps`) are in `GameConfig.js`, which imports only config. No new runtime deps, no comments beyond the non-obvious "why".
- `holeGrace` was a dangling field (written nowhere, cleared in `respawnAt`); now fully wired.
- `_respawnRun` removed to avoid dead code; the death handler calls `_respawnRoom`. ADR 0012 annotated as superseded for anvil maps.
- Grace-window ordering verified: `_updateDash` sets `holeGrace` on the dash-end frame (that frame does not decrement, since the decrement is in the non-dashing branch), and `checkHoleFalls` runs later in the same step, so the first post-dash frame sees a full grace window.

## Risks / follow-ups
- Not playtested in a browser; tolerance feel and respawn placement need a human pass.
- Forging the saw then dying in that room removes the saw (intended; anvil re-arms). Flagged in ADR 0014.
- Boss room replays its intro on a room death (room rebuilt). Accepted.
