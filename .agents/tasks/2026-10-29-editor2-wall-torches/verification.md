# Verification
- npm.cmd test -- torch_layout: reproduced failure (created wall returned null), then passed after fix.
- Regression fixtures cover four wall faces, lateral floor clicks, hole rejection, corner rejection, existing border and doors.
- npm.cmd run check: 39/40 suites; unchanged known modular_grid Curva SE and unlisted corridor_vertical_ns_1 errors. Docs updated after first run.
- Hidden Electron loaded actual editor2.html; created room and wall with model/paintWallCell, placed and removed torch via real ContentTools.apply. Result placedAndRemoved:true, errors:[] in _local/editor2-torch-result.json. First harness failed because initial map had no rooms; corrected to create explicit fixture room.
- npm.cmd run graph: rebuilt 3170 nodes, 6481 edges.
- git diff --check passed. User map/demo/demo_campaign.json changes untouched.
- Manual visual alignment, save/reload and human input were not exercised.

Hole follow-up: torch_layout passed (border/custom/left/right/fully hole-surrounded wall and isolated-cell rejection); full check 39/40 with same known grid/map failures. Hidden Editor2 ContentTools placed/removed torch beside a hole with errors:[]; no manual visual inspection. Earlier hole-rejection requirement superseded by user. Graph refreshed.
