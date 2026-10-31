# Verification — saw-tackle aim (enemies+stakes), rope cut, natural return

Date: 2026-10-31

## Commands
- `node --check` on every modified js file → syntax OK.
- `node tests/test_saw_tackle.js` → passes, including the new blocks:
  - aim assist curves toward an injected stake (and ignores a stake behind);
  - `sawGap` is Infinity for a resting loose saw and ≤0 when `weapon.tackleState` is set (flight) → cuts;
  - `_forceLanding` lands near the launch origin on a reachable point when trapped.
- `npm test` → 57/59. Only pre-existing failures: `test_arauto_effects` (committed `FLAME_GOLEM.telegraph.showMarks: true` debug flag on this branch) and `test_modular_grid` (#5). `test_arauto_das_brasas` and `test_flame_golem` are flaky under the parallel runner (RNG/timing) and pass standalone (ran both directly).

## Electron smoke run (real game, room `1,1`, `app://`, temp harness, since deleted)
Booted with 0 console errors. Report:
- `hasSawTackle: true`, `getAimTargetsWired: true`, `aimPointsIsArray: true` — wiring present in the runtime.
- `sawLoose: true` (dropped the saw to set up the tackle).
- `sawGapRestInfinite: true`, `sawGapFlightTouches: true` — rope cut only triggers while the saw is in a tackle flight.
- `tackled: true`, `aimCurvedTowardStake: true` (with a clear line of sight) — the aim assist curves toward a stake in the running build.

## What was NOT verified
- No human playtest: the feel of the (light) aim assist and the "returns near where launched" trajectory were not judged by a person.
- A live cage encounter actually being cut by a saw in flight was not driven end-to-end in the running game; only `StakeRope.sawGap` (the detection used by `CageEncounter._checkCuts` / `RopeChests.update`) was exercised live. The encounter must be `active` (both players in the zone with the chain connected) before its stakes are cuttable/aimed — consistent with the existing design.
- The Electron harness stepped systems directly and did not run the render pass, so the on-screen wind trail / cut FX were not observed.
