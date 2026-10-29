# Golem chain resistance

Status: done (script verification; gameplay feel pending)

Goal: resist saw and cable against the golem, transmit contact to players and keep surface damage.

Context: architecture, conventions, weapons, players-and-chain, combat-and-entities, status; ADR 0002/0003/0005; router, physics-tuning, code-review. Work continues on existing feat/flame-golem with unrelated working changes preserved.

Completed:
- ChainObstacleSystem and ChainCollisionConfig: sampled cable/disc versus grounded immovable body ellipses, correction transmitted to both players, inward velocity blocked, friction and motor load.
- Game orchestrates before saw collision and again after wall/clamp correction; infeasible pinching force-drops saw safely (existing fall helper renamed _dropSawSafely).
- CombatSystem consumes physical surface contacts; no stale contact damage; ordinary enemies and airborne distance rules preserved.
- ThrownSaw rebounds on grounded immovable body and records one surface hit per throw.
- Tests and independent standards/spec review; see verification.md and review.md.

No new structural ADR: follows existing injected-system orchestration and config ownership.
