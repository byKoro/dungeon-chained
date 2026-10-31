# Arauto random attacks

Goal: replace pressure with equal random choices so attack2 is available in phases 1 and 2. Continue the existing feature branch.

Read: architecture, conventions, combat-and-entities, status, glossary, ADR 0002/0003; router, diagnosing-bugs, game-ai and project notes, code-review.

Steps:
1. Reproduce immediate attack2 rejection in tests/test_arauto_random_attacks.js (observed red).
2. Remove pressure state and choose valid attacks randomly in FlameGolemEnemy.js; probability in FlameGolemConfig.js.
3. Update legacy pressure assertions; preserve terrain/sequence coverage.
4. Run focused tests and full check; review Standards and Spec with parallel agents; update system/status docs.

Verification: deterministic low/high RNG at the real update entry point in both phases; phase 2 dash/jump competition; existing AI terrain tests. Runtime feel requires playtest.

## Follow-up: tracking and sequences
User requests the old tracking and phase 2 triple jump/double dash. Compared against pre-reactive commit 8a82a7b^: fixed marks during warning; dash angular trackingStrength 0.025 during movement. Restore those rules, retaining safe terrain validation for any steering, and set sequence as default. Regression command: node tests/test_arauto_tracking_sequences.js (observed red before fix: moved jump warning mark).

## Follow-up: distant pursuit variety (2026-10-31)
User wants walking pursuit mixed with ranged attacks. Add a committed walking timer so random pursuit is not re-rolled every simulation step. At valid ranged choice: 60% attack, 40% walk for random 60..105 ticks. Near melee takes priority; phase 2 keeps dash/jump choice and sequences. Regression test tests/test_arauto_chase_choice.js failed before change (windup instead of chase) and passed after.

## Follow-up: attack1/attack2 repetition memory (2026-10-31)
User reports repeated predictable attacks while moving in/out of range. Reduce the previous attack weight progressively instead of forced alternation. Store last attack/attack2 and streak at windup start; retain history across pursuit, retreat and dash. Nearby normalized weights use ai.closeAttackRepeatWeight ** streak (0.35). Regression command node tests/test_arauto_attack_memory.js failed before fix, passes after; covers both phases and real recovery/retreat/re-entry.

## Follow-up: nearby walking/dash variety (2026-10-31)
User suggests mixing walking and dash into nearby decisions too. Nearby action mix: 60% adaptive attack1/attack2, 25% walking24..54ticks, 15% safe dash targeting the nearby player. Invalid dash falls back to the close pair. A separate nearby walking timer commits pursuit even with a close target; existing ranged pursuit still permits near reaction. Preserve repeat memory and phase2 sequences. New real-update regression tests/test_arauto_close_variety.js observed red before fix and green after in both phases.
