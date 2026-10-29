# Golem solid body

Goal: players block against the golem and are displaced by its walking and raised arms, without pushing it.

Docs read: architecture, conventions, players-and-chain, combat-and-entities, status, glossary; ADR 0002/0003/0005; router, diagnosing-bugs, physics-tuning and code-review skills.

Steps completed:
- Reproduce pass-through with tests/test_golem_solid_body.js (red before fix).
- Physics.js: one-sided resolution for immovable bodies; saw cannot move them.
- FlameGolemEnemy.js / FlameGolemConfig.js: solid torso and animated arm ellipses; only airborne ignores bodies; normal melee reach matches enlarged body.
- Regression coverage and documentation; preserve pre-existing dirty changes on feat/flame-golem.

Verification: see verification.md. No structural ADR needed.
