# Review — saw-tackle aim (enemies+stakes), rope cut, natural return

Date: 2026-10-31

## Scope
- `StakeRope.sawGap`: +1 condition (`w.tackleState`) so the tackled saw in flight cuts ropes. Single source of truth for cage, chest-rope and gate-rope cutting, so all rope types are covered at once.
- `SawTackle`: new `getAimTargets` injection; `_assistAim` refactored to iterate `_aimCandidates()` (enemies + injected stake points). `_forceLanding` prefers a reachable point near the launch origin.
- `CageEncounter.stakeAimPoints()` / `RopeChests.stakeAimPoints()` / `RoomEvents.aimPoints()`: expose uncut stake world points; Game wires `getAimTargets`.

## Self-review
- ADR 0002/0003 respected: aim-target plumbing is injected via constructor options; stake geometry stays in the owning handlers; Game only wires the lambda. No config magic numbers added (reused `aimCone/Range/MaxTurn`). Rope-cut threshold stays in the existing `sawGap`/`stakeRadius`.
- Backward compatible: `getAimTargets` defaults to null; classic maps (no `roomEvents`) pass `?? []`. `_assistAim` behaviour for enemy-only maps is unchanged (same scoring).
- Rope cut is gated correctly: `CageEncounter._checkCuts` only runs when the encounter is `active` (both players entered the zone while connected), so a loose saw can't pre-cut an un-armed encounter. `RopeChests` cuts whenever the saw is near a stake, which already accepted connected/thrown/inertia saws — adding the tackle flight is consistent.
- `_forceLanding` only changes the trapped/timeout fallback; the normal return/landing path (which already lands on a `reachableDropPoint`) is untouched, so the "near origin" change can't make a normal landing worse.

## Risks / follow-ups
- Not playtested by a human; aim-assist strength and return feel need a pass.
- A live cage encounter cut by a saw in flight wasn't driven end-to-end (only `sawGap` live). Worth a manual check.
