# Verification

- node tests/test_arauto_effects.js: pass. Real SpawnSystem material identity; blood-free contact, saw stays clean, debris settle/bounded/expiry/no blood stamps; ground shake; actual Game._step freeze dispatch; safe phase timing; scared?angry?clear; exact camera restoration and one scene per boss; reset mid-scene cleanup; full raised-pose hold and one ground event on miss.
- npm.cmd test -- flame_golem, -- arauto, -- combat_feel: pass after intentional prep test update.
- npm.cmd run check:24/25 suites pass. Only known grid CurvaSE failure and unlisted corridor_vertical_ns_1 map piece remain (status #4/#5). Docs gate passes; default sandbox cannot find graphify.
- git diff --check: no whitespace errors, existing CRLF warnings only.
- Actual hidden Electron Game harness served only localhost: _local/arauto-runtime.cjs + browser.js. Loaded real Game/assets/RoomCatalog, stepped real phase scene and dash, captured before/transformation/anger/phase2/dash. Result _local/arauto-runtime-result.json: frozen=true, scared=true, angry=true, phase=2, sceneEnded=true, crackPixels148, trailCount6, fragments70, errors=[].
- Visually inspected actual Game screenshots _local/arauto-transformation.png, _local/arauto-phase2.png, _local/arauto-dash.png. Bars/HUD reactions, masked fullbody cracks, particle burst and local dash trail visible. Pose contact sheet _local/arauto-poses.png confirms frame4 raised/frame5 downswing.
- Graph refresh requested in working elevated environment.
- Human co-op balance, motion comfort and sustained performance profiling not verified. Automated captures establish rendering and state behavior, not subjective feel.
