# Verification

- node tests/test_arauto_random_attacks.js: failed before fix (phase 1 high roll still selected attack), passed after fix. Covers both phases near and phase 2 distance selection with deterministic RNG.
- npm.cmd test -- arauto_ai: passed (walls, holes, safe landing, chase, sequence modes and ranges).
- npm.cmd test -- flame_golem: 2/2 passed.
- npm.cmd run check: 47/49 test files passed; only pre-existing test_arauto_effects showMarks mismatch and test_modular_grid failure. Map gate retains unlisted corridor_vertical_ns_1.json. No new failures.
- git diff --check: passed.
- npm.cmd run graph: unavailable because graphify is not installed; gate also skips graph.
- Game not opened: visual behavior and combat feel require playtest.

Cause: continuous-proximity pressure gate in phase 1 and absolute melee/dash priorities in phase 2 suppressed attack2. Replaced with equal random selection among the relevant safe alternatives. Choices can repeat.

## Tracking/sequences follow-up
- node tests/test_arauto_tracking_sequences.js: red before fix (jump mark followed moved target), green after. Default phase 2 executes 3 impacts / 2 dash launches.
- npm.cmd test -- flame_golem: 2/2 passed; exact old angular correction and fixed warning assertions pass.
- npm.cmd test -- arauto_ai and -- arauto_das_brasas: passed, including sequence modes and terrain coverage. Dash travel test now measures arc length with steering; explicit melee test forces melee to avoid randomized selection flakiness.
- npm.cmd run check: 48/50 tests pass; only the same pre-existing effects and modular-grid failures plus unlisted corridor map. git diff --check passed.
- npm.cmd run graph: graphify unavailable. Game not opened; runtime combat feel not observed.

## Distant pursuit follow-up (2026-10-31)
- node tests/test_arauto_chase_choice.js: red before change (windup instead of chase), green after. Covers both phases walking, movement, no repeated RNG, later dash and near-target reaction.
- node tests/test_arauto_random_attacks.js: passed with separate pursuit and ranged-attack rolls.
- npm.cmd test -- flame_golem: 2/2 passed.
- npm.cmd run check: 49/51 test files passed; only pre-existing effects showMarks and modular-grid failures. Map still fails for unlisted corridor_vertical_ns_1.json. No new failures.
- git diff --check passed. npm.cmd run graph unavailable (graphify absent). Game not opened; combat feel requires playtest.

## Attack repetition memory follow-up (2026-10-31)
- node tests/test_arauto_attack_memory.js: observed red before change, green after; both phases, actual recovery/retreat/re-entry, allowed repeats and progressive weighting.
- npm.cmd test -- flame_golem: 2/2 pass. Arauto tests pass except existing effects failure.
- npm.cmd run check: 50/52 pass, only pre-existing test_arauto_effects and test_modular_grid failures; map still fails for unlisted corridor_vertical_ns_1.json.
- git diff --check passed before doc-only updates. npm.cmd run graph unavailable (graphify missing). Game not opened; combat feel not observed.

## Nearby action variety follow-up (2026-10-31)
- node tests/test_arauto_close_variety.js: red before change (windup instead of walking), green after in both phases. Covers actual walking, no per-frame roll, eventual re-evaluation, near dash target and invalid-dash fallback.
- Memory and random selection fixtures now separately control action and close-attack rolls.
- npm.cmd test -- flame_golem: 2/2 pass.
- npm.cmd run check: 51/53 tests pass, only pre-existing effects and modular-grid failures; unlisted corridor map remains. git diff --check passes. npm.cmd run graph unavailable.
- Game not opened; runtime feel unobserved.
