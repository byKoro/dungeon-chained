# Softer saw resistance

Status: done (script verification; live gameplay feel pending)

Goal: lighter saw/cable contact against the golem and uninterrupted rotation during active cutting. Approved plan in conversation.

Context read: architecture, conventions, weapons, players-and-chain, combat-and-entities, status, router and physics notes (same ongoing task series). Existing feature branch/dirty work preserved.

Steps:
1. ChainCollisionConfig: friction .03, inward resistance .25, compression8, soft correction strength .25, shared correction budget2px/step. Hard correction beyond compression remains for solid limit.
2. ChainObstacleSystem: reset soft budget once in beginStep; consume across solver calls; apply friction/velocity reduction once per enemy/step; no motor mutation; permitted compression is successful contact.
3. SawWeaponConfig/SawWeapon: active cutting floor .7, activation .35, hold8steps; contact/hits sustain motor, drop/pickup clear sustain; idle contact does not start motor.
4. Regression tests for soft correction budget, lateral slide, hard limit/pinch, prolonged solid/ordinary contacts, release and idle/drop behavior.
5. Independent standards/spec review, full check, graph refresh, durable docs.

See verification.md and review.md. Runtime co-op feel not observed.

