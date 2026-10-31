# Verification

- `npm test -- saw_tackle`: 2/2 files pass, including new attack1 and dash assertions.
- `npm test -- flame_golem_abilities`: 1/1 file passes.
- Tests cover attack1 warning vs impact, range, radial direction, connected/active saw protection; dash warning, swept contact, forward direction even behind current boss position, missed range, wall blocking and no renewed impulse during flight.
- Actual FlameGolemEnemy entities constructed through SpawnSystem execute attack and attack3 against real Player objects; actual frame flags trigger boss-mode saw flight in both cases.
- `npm run check`: 53/55 test files pass. Existing unrelated failures: test_arauto_effects.js and test_modular_grid.js; map validation still fails on unlisted corridor_vertical_ns_1.json.
- `git diff --check`: passed (line-ending notices only).
- `npm run graph`: graphify unavailable; npm run doctor can inspect setup.

Not verified: manual co-op gameplay or browser runtime for this change. Existing two tackle flight variants and landing fix retained. No commit or PR created; existing feature work remains in the shared working tree.
