# Verification
- node tests/test_flame_golem.js: passed spawn/asset key, editor thumbnail, slow movement, frozen spawn, three attacks in sequence with hits at ticks 30/30/25, escaping reach, 6 ordinary hits, complete death drawing all six frames before removal.
- node tests/test_editor2_content_catalog.js: passed.
- npm.cmd run check: 19/20 tests passed. Only pre-existing failures #4/#5 (Curva SE and corridor_vertical_ns_1.json absent from map/index.json).
- Graphify unavailable; check skips graph. Run npm run doctor to inspect environment.
- Chromium headless on localhost: original PNG decoded; actual SpawnSystem and MeleeEnemy.draw rendered every walk/attack/death frame over standard tiles. DOM reports PASS. Screenshot inspected: _local/flame-golem-browser.png. This is a drawing harness, not a game session.
- Sheet alpha bounds inspected with Pillow: walk 12 frames, attacks 9 each, death 6; all fit existing crop (30,20,59,39). Original PNG unchanged.
Not verified: live co-op gameplay, balance, audio, packaged Electron, editor mouse placement. Damage remains generic melee on the nearest target; flame/debris art does not imply AoE.
