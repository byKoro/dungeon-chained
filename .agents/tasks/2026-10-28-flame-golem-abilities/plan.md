# Flame Golem abilities and phases
Date: 2026-10-28 (America/Cuiaba). Branch: feat/flame-golem.
Goal: implement approved normal melee, large radial knockback attack, marked delayed dash, and two HP-based phases. Original PNG and authored room preserved.
Confirmed sprite mapping: PNG rows 3/4/5 (zero-based 2/3/4); row 2 is walk, row 1 flash. User clarified phase one = one slower dash; phase two = two dashes and faster movement/attack animations.
Read: AGENTS, router, game-ai and PROJECT-NOTES, add-enemy, architecture, conventions, combat-and-entities, rendering, players-and-chain, status, existing MeleeEnemy/Cultist/Player/Physics/SpawnSystem, code-review.
Completed: extract small attack lifecycle hooks from MeleeEnemy; add FlameGolemConfig + subclass; optional Player knockback; spawn wiring; ability/phase/regression tests; actual Game verification in authored sanctuary room via in-memory map; standards/spec review; docs and check.
No map edits, new art, cinematic, bridge or altar in this task. Existing uncommitted work preserved.
