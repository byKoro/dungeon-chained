# Two-axis review
Scope: this task only, compared with initial working-tree baseline (previous cinematic/basic golem changes excluded).
## Standards
Parallel Standards agent: 0 actionable findings. Existing lifecycle reused; default player damage preserved; all tuning in config.
## Spec
Parallel Spec agent found phase-one animation/movement multipliers were exposed but initially unused. Fixed by applying phase stats at construction and at transition; regression test edits phase-one multipliers and verifies movement, animation, death timing and pose continuity.
Final requirements: normal hit, AoE hits both players, accepted-damage-only knockback, marked delayed charges, tracking, one dash in phase one/two in phase two, HP threshold and speed multipliers configurable.
