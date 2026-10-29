# Verification

- node tests/test_golem_solid_body.js: red before fix, green after; blocking, walking, raising arms, coincident centers, pair order, saw immovability, airborne, solid charge, melee approach from four sides.
- npm.cmd test -- flame_golem: 2/2 pass.
- npm.cmd test -- arauto: 1/1 pass; charge still travels configured full distance.
- npm.cmd run check: 22/23 suites pass; only existing test_modular_grid and unlisted corridor_vertical_ns_1.json map failures (status #4/#5).
- npm.cmd run graph: unavailable (graphify not installed).
- Game was not opened. Sprite/collider alignment and co-op feel require gameplay verification.
